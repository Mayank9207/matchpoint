const mongoose = require('mongoose');
const {Schema} = mongoose;

const matchSchema = new Schema({
    title: {type : String , trim :  true},
    sport: {type : String,required: true,trim : true},
    datetime: {type:Date, required : true},
    location: {
        type:{
            type : String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates : {
            type:[Number],
            required:true
        }
    },
    age: {
        minAge: {type:Number,default:18,min:0,max:100},
        maxAge: {type:Number,default:60,min:0,max:100}
    },

    host: {type:Schema.Types.ObjectId, ref:'User', required: true },

    participants: [
        {
            user:{type:Schema.Types.ObjectId,ref:'User'},
            joinedAt:{type:Date,default: ()=>new Date()}
        }
        
    ],

    capacity:{type:Number,required:true,min:1,max:10},

    gender:{type:String,enum:['any','male','female','mixed'],default:'any'},

    status:{type:String,enum:['completed','cancelled','scheduled'],default:'scheduled'},

    description:{type:String,trim:true},

    visibility:{type:String,enum:['public','private'],default:'private'}
},
{timestamps:true});

//once the basic structure is done now we need to think what are the custom search fields we shall be using
//so that our search time is optimised for searched we will need to perform 
//so first would be search based on location,second would be search based on sports and datetime 
// another might be

matchSchema.index({ location: '2dsphere' });
matchSchema.index({ host: 1 });
matchSchema.index({ sport: 1, gender: 1, datetime: 1 });
matchSchema.index({ sport: 1, 'age.minAge': 1, 'age.maxAge': 1, datetime: 1 });

module.exports = mongoose.model('Match', matchSchema);