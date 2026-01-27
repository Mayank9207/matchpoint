const express = require('express');
const router = express.Router();
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

router.post('/', auth, async (req, res, next) => {
    try {
        const { sport, datetime, location, capacity } = req.body;//these parameter names need to be same as those in the model obv

        // FIXED: Validation & Defensive Checks
        if (!sport) return res.status(400).json({ success: false, error: 'sport required' });
        
        const dateObj = new Date(datetime);
        if (isNaN(dateObj.valueOf())) return res.status(400).json({ success: false, error: 'invalid datetime' });
        if (dateObj <= Date.now()) return res.status(400).json({ success:false, error:'datetime must be in the future' });

        
        if (!location || location.lat == null || location.lng == null) {
            return res.status(400).json({ success: false, error: 'location (lat/lng) required' });
        }

        const cap = Number(capacity);
        if (isNaN(cap) || cap < 1) return res.status(400).json({ success: false, error: 'capacity must be >=1' });

        const match = await Match.create({
            sport,
            datetime: dateObj,//why are we converting datetime to Date object because in the model datetime is of type Date
            location: { 
                type: 'Point', 
                coordinates: [Number(location.lng), Number(location.lat)] // Fixed: Convert to Numbers
            },//we are using computed property names here to create the coordinates array
            //otherwise mongo db will not understand location properly
            host: req.user.id,
            capacity: cap
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

