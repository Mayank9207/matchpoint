const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
    trim:true,
    unique:true,
    minlength:3,
  },
  email : {
    type:String,
    required:true,
    unique:true,
    lowercase:true
  },
  password:{
    type:String,
    required:true,
    minlength:6,
    select:false,
  },
  sportsplayed: [{ // An array of objects
    sport: {
      type: String,
      required: true,
      trim: true
    },
    location: { // Each sport has an associated location
      lat: Number,
      lon: Number
    }
  }],
}, { timestamps: true });


//to check password while login 
// we need to hash the entered password and check it with the already stored
//hash during registration

userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword= async function (entered_pass) {
    return await bcrypt.compare(entered_pass,this.password);
}

module.exports = mongoose.model('User', userSchema);
