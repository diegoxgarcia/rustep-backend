const { prisma } = require('../../config/postgres.config');
const config = require('../../config/env.config');

/**
 * Derive gpsVarianceMeters and avgSpeedKmh from raw GPS points array.
 * Each point: { lat, lng, timestamp }
 */
exports.deriveGpsMetrics = (gpsPoints, sessionStart, sessionEnd) => {
  if (!gpsPoints || gpsPoints.length < 2) {
    return { gpsVarianceMeters: null, avgSpeedKmh: null };
  }

  // Haversine distance between two lat/lng points (returns meters)
  const haversine = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Total distance
  let totalDistanceMeters = 0;
  const distances = [];
  for (let i = 1; i < gpsPoints.length; i++) {
    const d = haversine(
      gpsPoints[i - 1].lat, gpsPoints[i - 1].lng,
      gpsPoints[i].lat,     gpsPoints[i].lng
    );
    distances.push(d);
    totalDistanceMeters += d;
  }

  // Variance = std dev of segment distances
  const meanDist = totalDistanceMeters / distances.length;
  const variance = distances.reduce((s, d) => s + (d - meanDist) ** 2, 0) / distances.length;
  const gpsVarianceMeters = Math.sqrt(variance);

  // Avg speed from total distance / session duration
  const durationHours = (sessionEnd - sessionStart) / (1000 * 3600);
  const avgSpeedKmh   = durationHours > 0 ? (totalDistanceMeters / 1000) / durationHours : null;

  return { gpsVarianceMeters, avgSpeedKmh };
};

/**
 * Calculate confidence score for fraud detection
 */
exports.calculateConfidenceScore = (sessionData) => {
  const {
    stepsCount,
    startTime,
    endTime,
    gpsVarianceMeters,
    avgSpeedKmh,
    stepsDistribution
  } = sessionData;

  let score = 1.0; // Start with perfect confidence

  // Calculate duration in minutes
  const durationMinutes = (endTime - startTime) / (1000 * 60);

  // Check 1: Steps per minute (normal range: 80-150 steps/min for running)
  const stepsPerMinute = stepsCount / durationMinutes;
  if (stepsPerMinute > 200 || stepsPerMinute < 50) {
    score -= 0.3;
  } else if (stepsPerMinute > 180 || stepsPerMinute < 60) {
    score -= 0.15;
  }

  // Check 2: GPS variance (should have some movement)
  if (gpsVarianceMeters !== null && gpsVarianceMeters !== undefined) {
    if (gpsVarianceMeters < 10) {
      score -= 0.25; // Too little movement
    } else if (gpsVarianceMeters > 10000) {
      score -= 0.2; // Unrealistic movement
    }
  }

  // Check 3: Average speed (normal running: 6-15 km/h)
  if (avgSpeedKmh !== null && avgSpeedKmh !== undefined) {
    if (avgSpeedKmh > 20) {
      score -= 0.3; // Too fast (vehicle)
    } else if (avgSpeedKmh < 3) {
      score -= 0.2; // Too slow (fake steps)
    }
  }

  // Check 4: Steps distribution consistency
  if (stepsDistribution && stepsDistribution.length > 0) {
    const avgStepsPerBucket = stepsCount / stepsDistribution.length;
    let highVariance = false;

    stepsDistribution.forEach(bucket => {
      const diff = Math.abs(bucket.steps - avgStepsPerBucket);
      if (diff > avgStepsPerBucket * 2) {
        highVariance = true;
      }
    });

    if (highVariance) {
      score -= 0.15;
    }
  }

  // Check 5: Session duration (very short or very long sessions are suspicious)
  if (durationMinutes < 5) {
    score -= 0.1;
  } else if (durationMinutes > 180) { // More than 3 hours
    score -= 0.15;
  }

  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
};

/**
 * Determine confidence status based on score
 */
exports.determineConfidenceStatus = (confidenceScore) => {
  const threshold = config.stamina.fraudThresholdConfidence;

  if (confidenceScore >= 0.7) {
    return 'valid';
  } else if (confidenceScore >= threshold) {
    return 'suspicious';
  } else {
    return 'blocked';
  }
};

/**
 * Credit stamina for valid steps
 */
exports.creditStamina = async (userId, stepsCount, stepsLogId) => {
  const staminaPerThousand = config.stamina.perThousandSteps;
  const staminaAmount = Math.floor((stepsCount / 1000) * staminaPerThousand);

  if (staminaAmount <= 0) {
    return 0;
  }

  // Check daily stamina limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCredits = await prisma.staminaLedger.aggregate({
    where: {
      userId: userId.toString(),
      type: 'STEPS_CREDIT',
      createdAt: { gte: today }
    },
    _sum: {
      amount: true
    }
  });

  const currentDailyStamina = todayCredits._sum.amount || 0;
  const maxDaily = config.stamina.maxPerDay;
  const availableStamina = maxDaily - currentDailyStamina;

  if (availableStamina <= 0) {
    return 0; // Daily limit reached
  }

  const finalStamina = Math.min(staminaAmount, availableStamina);

  // Create stamina ledger entry
  await prisma.staminaLedger.create({
    data: {
      userId: userId.toString(),
      amount: finalStamina,
      type: 'STEPS_CREDIT',
      referenceId: stepsLogId.toString(),
      description: `Stamina from ${stepsCount} steps`
    }
  });

  return finalStamina;
};

/**
 * Get ISO week number
 */
exports.getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};
