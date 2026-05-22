const RecentPlace = require('../models/service');

const DEFAULT_USER_ID = process.env.RECENT_PLACES_DEFAULT_USER_ID || 'testUser01';

const resolveUserId = (req) => {
	return req.body?.userId || req.query?.userId || DEFAULT_USER_ID;
};

const normalizeAction = (action) => {
	return action === 'Got Direction' ? 'Got Direction' : null;
};

const normalizeImageUrls = (imageUrls) => {
	if (!Array.isArray(imageUrls)) return [];
	return [...new Set(imageUrls.filter(Boolean))].slice(0, 2);
};

const resolvePlaceId = (req) => {
	return req.body?.placeId || req.body?.place_id || req.query?.placeId || req.query?.place_id || null;
};

const fetchPlaceImageUrls = async (placeId) => {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) {
		console.warn('[recentPlaces] GOOGLE_MAPS_API_KEY is missing. imageUrls will stay empty.');
		return [];
	}

	if (!placeId) return [];

	const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
	url.searchParams.set('place_id', placeId);
	url.searchParams.set('fields', 'photos');
	url.searchParams.set('key', apiKey);

	const response = await fetch(url.toString());
	if (!response.ok) return [];

	const payload = await response.json();
	const photos = payload?.result?.photos || [];

	return photos.slice(0, 2).map((photo) => {
		const reference = photo.photo_reference;
		return reference
			? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${encodeURIComponent(reference)}&key=${apiKey}`
			: '';
	}).filter(Boolean);
};

const getRecentPlaces = async (req, res) => {
	try {
		const { limit = 50 } = req.query;
		const resolvedUserId = resolveUserId(req);
		const filter = { userId: resolvedUserId };
		const recentPlaces = await RecentPlace.find(filter)
			.sort({ timestamp: -1 })
			.limit(Math.max(1, Math.min(Number(limit) || 50, 200)));

		res.status(200).json({
			success: true,
			count: recentPlaces.length,
			data: recentPlaces,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch recent places',
			error: error.message,
		});
	}
};

const createRecentPlace = async (req, res) => {
	try {
		const {
			name,
			placeId,
			action,
			imageUrls,
			imageUrl,
			timestamp,
		} = req.body;

		const resolvedUserId = resolveUserId(req);
		const resolvedName = name || req.body.placeName;
		const resolvedPlaceId = placeId || resolvePlaceId(req);
		const resolvedAction = normalizeAction(action);
		const resolvedImageUrls = normalizeImageUrls(imageUrls || (imageUrl ? [imageUrl] : []));
		const fetchedImageUrls = resolvedImageUrls.length > 0 ? resolvedImageUrls : await fetchPlaceImageUrls(resolvedPlaceId);
		const imageUrlsToStore = normalizeImageUrls(fetchedImageUrls);
		const lookupQuery = {
			userId: resolvedUserId,
			...(resolvedPlaceId ? { placeId: resolvedPlaceId } : { name: resolvedName }),
		};

		if (!resolvedName) {
			return res.status(400).json({
				success: false,
				message: 'name is required',
			});
		}

		let existingRecentPlace = await RecentPlace.findOne({
			...lookupQuery,
		});

		if (!existingRecentPlace) {
			const recentPlace = await RecentPlace.create({
				userId: resolvedUserId,
				name: resolvedName,
				placeId: resolvedPlaceId,
				imageUrls: imageUrlsToStore,
				imageUrl: imageUrlsToStore[0] || imageUrl || undefined,
				action: resolvedAction,
				timestamp,
			});

			return res.status(201).json({
				success: true,
				message: 'Recent place saved successfully',
				data: recentPlace,
			});
		}

		const updates = {};

		if (resolvedAction === 'Got Direction' && existingRecentPlace.action !== 'Got Direction') {
			updates.action = 'Got Direction';
		}

		if (imageUrlsToStore.length > 0) {
			updates.imageUrls = imageUrlsToStore;
			updates.imageUrl = imageUrlsToStore[0];
		} else if (imageUrl && !existingRecentPlace.imageUrl) {
			updates.imageUrl = imageUrl;
		}

		if (resolvedPlaceId && existingRecentPlace.placeId !== resolvedPlaceId) {
			updates.placeId = resolvedPlaceId;
		}

		if (timestamp && !existingRecentPlace.timestamp) {
			updates.timestamp = timestamp;
		}

		if (Object.keys(updates).length === 0) {
			return res.status(200).json({
				success: true,
				message: 'Recent place already exists',
				data: existingRecentPlace,
			});
		}

		await RecentPlace.updateOne(
			lookupQuery,
			{ $set: updates }
		);

		const updatedRecentPlace = await RecentPlace.findOne(lookupQuery);

		res.status(201).json({
			success: true,
			message: 'Recent place updated successfully',
			data: updatedRecentPlace || existingRecentPlace,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to save recent place',
			error: error.message,
		});
	}
};

module.exports = {
	getRecentPlaces,
	createRecentPlace,
};
