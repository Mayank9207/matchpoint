const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // correct relative path

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) basic validation
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // 2) find user and include password (if password field is select:false in schema)
    const user = await User.findOne({ email }).select('+password');
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
        user: { id: user._id, email: user.email }, // add name if you store it
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
try{

  let { name, email, password } = req.body;


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

  const user=await User.create({name,email,password});

    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 5) respond with token and user info (no password)
    //creation should return 201
    return res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, email: user.email }, // add name if you store it
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

router.get('/me', authMiddleware, async (req, res) => {
  // req.user is set by middleware
  return res.json({ success: true, user: req.user });
});


module.exports = router;
