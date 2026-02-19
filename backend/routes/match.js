const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/user'); // FIXED: Capitalized 'User' to match convention and prevent ReferenceError
const Match = require('../models/match');

function buildSort(sort) {
  if (sort === "distance") return { "dist.calculated": 1 };
  if (sort === "capacity") return { capacity: -1 };
  return { datetime: 1 };
}

router.get('/', async (req, res, next) => {
    try {
        // FIXED: Parse query params to Integers immediately to prevent math errors later
        const pageNum = parseInt(req.query.page) || 1;
        const limitNum = parseInt(req.query.limit) || 20;

        // FIXED: Extract 'sport' from query so it is defined
const { sport } = req.query;
const sort = req.query.sort || "datetime";

// parse geo params early, before deciding which query path to use
const lat = req.query.lat ? Number(req.query.lat) : null;
const lng = req.query.lng ? Number(req.query.lng) : null;
const radiusKm = req.query.radius ? Number(req.query.radius) : 10;
const useGeo = Number.isFinite(lat) && Number.isFinite(lng);

// base filter (future scheduled matches)
const filter = {
  status: "scheduled",
  datetime: { $gt: new Date() }
};
if (sport) filter.sport = sport;

let matches;
if (useGeo) {
  // aggregation pipeline: geoNear must be first
  const pipeline = [
    ...buildGeoQuery({ lat, lng, radiusKm, filter }),
    { $sort: buildSort(sort) },
    { $skip: (pageNum - 1) * limitNum },
    { $limit: limitNum },
    // optionally project fields here if you want
];

matches = await Match.aggregate(pipeline);

  // expose a friendly distance field in kilometers (rounded to 1 decimal)
matches = matches.map(m => ({
    ...m,
    distanceKm: m.dist && m.dist.calculated ? Math.round((m.dist.calculated / 1000) * 10) / 10 : null
  }));
} else {
  // normal find path (no geo)
  matches = await Match.find(filter)
    .sort(buildSort(sort))
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);
}

// debug log (temporary)
  if (useGeo) {
     console.log("USING GEO QUERY", { lat, lng, radiusKm, pageNum, limitNum, sort });
  } else {
    console.log("USING NORMAL QUERY", { pageNum, limitNum, sort, sport: filter.sport || null });
  }


        return res.status(200).json({ success: true, data: matches });//data is the array of matches returned
        //we write this response everytime we successfully get the data from the db

        //do we write only when we query not when we insert or update yes we write response only when we query the db like 
    }
    catch (err) {
        next(err);
    }
});

router.get('/:id', async(req, res, next) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: 'Invalid match id' });
    }

    try {
        const match = await Match.findById(id)
            .populate("host", "name email age")
            .populate("participants.user", "name age");

        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        
        return res.status(200).json({ success: true, data: match });
    }
    catch (err) {
        next(err);
    }
});

router.post('/', auth, async (req, res, next) => {
    try {
        const { sport, datetime, location, locationDetails, capacity, title, gender, age, description, images } = req.body;

        // FIXED: Validation & Defensive Checks
        if (!sport) return res.status(400).json({ success: false, error: 'sport required' });
        
        const dateObj = new Date(datetime);
        if (isNaN(dateObj.valueOf())) return res.status(400).json({ success: false, error: 'invalid datetime' });
        if (dateObj <= Date.now()) return res.status(400).json({ success:false, error:'datetime must be in the future' });

        
        const cap = Number(capacity);
        if (Number.isNaN(cap) || cap < 2 || cap > 22) {
            return res.status(400).json({ success: false, error: 'capacity must be between 2 and 22' });
        }

        let coordinates = null;
        if (location) {
            if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
                coordinates = [Number(location.coordinates[0]), Number(location.coordinates[1])];
            } else if (location.lng != null && location.lat != null) {
                coordinates = [Number(location.lng), Number(location.lat)];
            }
        }

        if (
            !coordinates ||
            !Number.isFinite(coordinates[0]) ||
            !Number.isFinite(coordinates[1])
        ) {
            return res.status(400).json({ success: false, error: 'location (lat/lng) required' });
        }

        const match = await Match.create({
            title: title || `${sport} Match`,
            sport,
            datetime: dateObj,
            location: {
                type: 'Point',
                coordinates
            },
            locationDetails: locationDetails || undefined,
            host: req.user.id,
            capacity: cap,
            gender: gender || 'any',
            age: age || { minAge: 18, maxAge: 60 },
            description: description || '',
            images: images || []
        });
        return res.status(201).json({ success: true, data: match }); //201 created status code
    }
    catch (err) {
        next(err);
    }
});

router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const matchId = req.params.id;
    const userId = req.user.id;

    // 1) Fetch user and match
    const user = await User.findById(userId).select('age');
    if (!user) return res.status(404).json({ success:false, error:'User not found' });

    const match = await Match.findById(matchId).select('participants capacity age status');
    if (!match) return res.status(404).json({ success:false, error:'Match not found' });

    // 2) Pre-checks for helpful errors
    if (match.status !== 'scheduled') {
      return res.status(400).json({ success:false, error:'Cannot join a non-scheduled match' });
    }

    if (match.participants.some(p => p.user.equals(userId))) {
      return res.status(409).json({ success:false, error:'User already joined' });
    }

    if (match.participants.length >= match.capacity) {
      return res.status(409).json({ success:false, error:'Match is full' });
    }

    if (user.age < match.age.minAge || user.age > match.age.maxAge) {
      return res.status(403).json({ success:false, error:'Age restricted for this match' });
    }

    // 3) Atomic add (still required to avoid race condition)
    const updatedMatch = await Match.findOneAndUpdate(
      {
        _id: matchId,
        'participants.user': { $ne: userId },
        $expr: { $lt: [{ $size: '$participants' }, '$capacity'] },
        status: 'scheduled'
      },
      { $push: { participants: { user: userId, joinedAt: new Date() } } },
      { new: true }
    );

    if (!updatedMatch) {
      // If this happens, it is a concurrent race (someone else took the last spot)
      return res.status(409).json({ success:false, error:'Could not join — try again (match may be full now)' });
    }

    return res.status(200).json({ success:true, data: updatedMatch });
  } catch (err) {
    next(err);
  }
});


router.post('/:id/leave',auth,async(req,res,next)=>{
  try{
    const matchId=req.params.id;
    const userId=req.user.id;

    const updatedMatch = await Match.findOneAndUpdate(
      {_id:matchId,'participants.user':userId},
      {$pull: {participants:{user:userId}}},
      {new:true},
    );

    if (!updatedMatch) return res.status(400).json({ success:false, error:'You are not part of this match' });

    return res.json({success:true,data:updatedMatch});
  }
  catch(err){
    next(err);
  }
});


router.patch('/:id',auth,async(req,res,next)=>{
  try{
    const {id} = req.params;
    const {action,datetime,capacity} = req.body;

    const match=await Match.findById(id);

    if(!match) return res.status(404).json({ success:false, error:'Match not found' });

    if(match.host.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success:false, error:'Only the host can update this match' });
    }

    if(match.status !== 'scheduled') {
      return res.status(400).json({ success:false, error:"Can't update a cancelled or completed match" });
    }

    switch(action){
      case 'cancel':{
        match.status='cancelled';
        break;
    }

      case 'reschedule': {
        const newDatetime=new Date(datetime);

        if(!newDatetime || newDatetime<=Date.now()){
          return res.status(400).json({ success:false, error:'Invalid datetime' });
        }
        match.datetime=newDatetime;
        break;
      }
      
      case 'update_capacity': {
        const cap = Number(capacity);
        if (
          Number.isNaN(cap) ||
          cap < 2 ||
          cap > 22 ||
          cap < match.participants.length
        ) {
          return res.status(400).json({
            success: false,
            error: 'Capacity must be between 2 and 22 and >= current participants'
          });
        }
        match.capacity = cap;
        break;
      }

      case 'close':
        match.status='completed';
        break;

      default:
        return res.status(400).json({ success:false, error:'Invalid action' });
    }

    await match.save();

    return res.json({success:true,data:match});
    
  }
  catch(err){
    next(err);
  }
});

function buildGeoQuery({lat,lng,radiusKm,filter}){
  return [
    {
      $geoNear:{
        near:{
          type:"Point",
          coordinates:[lng,lat]
        },
        distanceField:"dist.calculated",
        spherical:true,
        maxDistance:radiusKm*1000,
        query:filter
      }
    }
  ];
}

module.exports = router;

