const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user'); // FIXED: Capitalized 'User' to match convention and prevent ReferenceError
const Match = require('../models/match');

router.get('/', async (req, res, next) => {
    try {
        // FIXED: Parse query params to Integers immediately to prevent math errors later
        const pageNum = parseInt(req.query.page) || 1;
        const limitNum = parseInt(req.query.limit) || 20;

        // FIXED: Extract 'sport' from query so it is defined
        const { sport } = req.query;

        const filter = {};
        //what does req.query do it basically fetches the query parameters from the url
        //what does filter do it filters the matches based on the sport type if provided and returns all matches otherwise
        if (sport) {
            filter.sport = sport;
        }

        const matches = await Match.find(filter)//we write the filter here to filter based on the sport type
            .skip((pageNum - 1) * limitNum)//pagination logic (Fixed: ensure calculation is done with numbers)
            .limit(limitNum)//what is the purpose of Number here it converts the limit to a number from string
            .sort({ datetime: 1 });//sort by date ascending order (Fixed: used 'datetime' instead of 'date')
        
        //what are these .skip and .limit these are mongoose methods used for pagination basically we are 
        //querying the matches collection and skipping the first (page-1)*limit documents and limiting the result to limit documents
        //so when we use find we are querying the matches collection and getting the documents based on the filter searching db corresponding to the model

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

        // 1. Fetch User (Needed for Age check)
        const user = await User.findById(userId).select('age');
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        // 2. ATOMIC UPDATE (Fixes Race Conditions)
        // Instead of Fetch -> Check -> Save, we do it all in one database command.
        // This ensures two people cannot join the last spot at the exact same millisecond.
        const updatedMatch = await Match.findOneAndUpdate(
            {
                _id: matchId,
                status: 'scheduled',
                'participants.user': { $ne: userId }, // Check: Not already joined
                $expr: { $lt: [{ $size: '$participants' }, '$capacity'] }, // Check: Capacity not full
                // Check: Age Restrictions (matches your schema structure: age.minAge)
                'age.minAge': { $lte: user.age },
                'age.maxAge': { $gte: user.age }
            },
            {
                $push: { 
                    participants: { 
                        user: userId, 
                        joinedAt: new Date() 
                    } 
                }
            },
            { new: true } // Return the updated document
        );

        // 3. Handle Failure
        // If updatedMatch is null, it means one of the checks above failed
        if (!updatedMatch) {
            return res.status(409).json({ 
                success: false, 
                error: 'Unable to join: Match not found, full, age restricted, or already joined' 
            });
        }

        // 5. Response
        res.status(200).json({ success: true, data: updatedMatch });

    } catch (err) {
        next(err);
    }
});

module.exports = router;