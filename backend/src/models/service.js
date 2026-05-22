const mongoose = require('mongoose');

const recentPlaceSchema = new mongoose.Schema(
	{
		userId: {
			type: String,
			required: true,
			trim: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		placeId: {
			type: String,
			default: null,
			trim: true,
		},
		imageUrls: {
			type: [String],
			default: [],
		},
		action: {
			type: String,
			default: null,
			trim: true,
		},
		imageUrl: {
			type: String,
			trim: true,
		},
		timestamp: {
			type: Date,
			default: Date.now,
		},
	},
	{
		collection: process.env.RECENT_PLACES_COLLECTION || 'recentPlaces',
	}
);

module.exports = mongoose.model('RecentPlace', recentPlaceSchema);
