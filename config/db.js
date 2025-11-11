const mongoose=require('mongoose');
const dotenv=require('dotenv');
dotenv.config();

//no external parameters will be used here as all the stuff is being fetched from .env file
async function connectdb() {
    try{
    console.log('Connecting to MongoDB at', process.env.MONGO_URI ? 'URI found ✅' : '❌ Missing URI');

      const res=await mongoose.connect(process.env.MONGO_URI);
        console.log("Mongodb succesfully connected");
    }
    catch(err){
        console.log("error",err.message);
    }
}

module.exports=connectdb;