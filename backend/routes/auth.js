const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // correct relative path

// in auth routes file
//for later updates of age

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) basic validation
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // 2) find user and include password (if password field is select:false in schema)
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // 3) compare passwords using the instance method
    const match = await user.matchPassword(password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    //do this inside the routes only not outise everything handled inside this stuff
    // 4) create JWT payload & sign token (do this AFTER successful auth)
    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 5) respond with token and user info (no password)
    return res.status(200).json({
      success: true,
      data: {
        user: { id: user._id, email: user.email, name: user.name }, // include name
        token
      }
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/register',async(req,res)=>{
//now i will be writing the try catch block where i will try to implement registration and if
// any of that fails then i will return the specified errors
console.log("REGISTER HIT");
try{

  let { name, email, password,age } = req.body;


  if(!email || !name || !password){
    return res.status(400).json({success:false,error:'Incomplete credentials'});
  }
  //if the above error is not found then we need to run a db query to check whether the current 
  // entered email exists or not inside the email

    email = email.toLowerCase().trim();
    name = name.trim();

  const chk=await User.findOne({email});
  //now if the email already exists then we need to terminate
  if(chk){
    return res.status(409).json({success:false,error:'The given email is already registered with another account '});
  }
  //now i need to validate that the password has length greater than or equal to 6
  if(password.length<6){
    return res.status(400).json({success: false,error : 'The password must be atleast 6 characters long '});
  }
  //now if all the errors are fixed then i need to create the user
  // normalize age (IMPORTANT)
if (age === undefined || age === null || age === "") {
  age = 18; // explicit default
}

const ageNum = Number(age);
if (isNaN(ageNum) || ageNum < 0 || ageNum > 100) {
  return res.status(400).json({
    success: false,
    error: "Invalid age (0-100)"
  });
}

age = ageNum;

  

console.log("REGISTER BODY:", req.body);
console.log("AGE BEFORE CREATE:", age, typeof age);
console.log("SCHEMA PATHS:", Object.keys(User.schema.paths));


  const user=await User.create({name,email,password,age});

    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 5) respond with token and user info (no password)
    //creation should return 201
    return res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, email: user.email, name: user.name }, // include name
        token
      }

});
}
catch (err) {

    if(err.code == 11000){
      return res.status(409).json({ success:false, error:'Email already in use'});
    }
   
    console.error('Register error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

);

const authMiddleware = require('../middleware/auth');
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.age !== undefined) {
      const ageNum = Number(req.body.age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 100) {
        return res.status(400).json({ success: false, error: 'Invalid age (0-100)' });
      }
      updates.age = ageNum;
    }
    if (req.body.name) updates.name = String(req.body.name).trim();

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    return res.json({ success: true, data: 
      {
        user
   } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});



router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (err) {
    console.error('GET /me error', err);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});



module.exports = router;
