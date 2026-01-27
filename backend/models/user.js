const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');
console.log("✅ USER MODEL LOADED FROM:", __filename);

const userSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true,
    trim:true,
    minlength:3,
  },
  email : {
    type:String,
    required:true,
    unique:true,
    lowercase:true
  },
  age : {
    type:Number,
    default:18,
    min:0,
    max:100
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

userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword= async function (entered_pass) {
    return await bcrypt.compare(entered_pass,this.password);
}

module.exports = mongoose.model('User', userSchema);
