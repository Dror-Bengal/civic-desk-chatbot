import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  channelType: {
    type: String,
    enum: ['web', 'whatsapp', 'widget', 'telegram'],
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isBlocked: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Unique compound index on channel type and ID
userSchema.index({ channelType: 1, channelId: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
