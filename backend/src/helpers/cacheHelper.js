const redisClient = require("../../config/redis");

/**
 * Invalidate all dashboard-related cache keys (sales reports + stats).
 * Uses KEYS pattern scan - acceptable at small scale.
 */
async function invalidateDashboardCache(businessId) {
  try {
    const suffix = businessId ? `:${businessId}` : "";
    const [salesKeys, statsKeys, menuKeys, customerKeys] = await Promise.all([
      redisClient.keys(`sales:*${suffix}`),
      redisClient.keys(`stats:*${suffix}`),
      redisClient.keys(`menu-analytics${suffix}`),
      redisClient.keys(`customer-analytics${suffix}`),
    ]);
    const allKeys = [...salesKeys, ...statsKeys, ...menuKeys, ...customerKeys];
    if (allKeys.length) {
      await redisClient.del(allKeys);
      console.log(`Dashboard cache invalidated (${allKeys.length} keys) for ${businessId || "all"}`);
    }
  } catch (err) {
    console.error("Cache invalidation error:", err);
  }
}

/**
 * Invalidate the admin coupon list cache.
 */
async function invalidateAdminListCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`admin-list:coupons:${businessId}`);
    } else {
      await redisClient.del("admin-list:coupons");
    }
  } catch (err) {
    console.error("Redis DEL failed (admin-list)", err);
  }
}

async function invalidateReviewCache(businessId) {
  try {
    const suffix = businessId ? `:${businessId}` : "";
    const [keys, adminSearchKeys] = await Promise.all([
      redisClient.keys(`reviews:*${suffix}`),
      redisClient.keys(`adminSearch:*${suffix}`),
    ]);
    const allKeys = [...keys, ...adminSearchKeys];
    if (allKeys.length) {
      await redisClient.del(allKeys);
      console.log(`Review cache invalidated (${allKeys.length} keys) for ${businessId || "all"}`);
    }
  } catch (err) {
    console.error("Redis DEL failed (reviews)", err);
  }
} 

async function invalidateOrderHistoryCache(phone, businessId) {
  try {
    if (businessId) {
      await redisClient.del(`order-history:${phone}:${businessId}`);
    } else {
      await redisClient.del(`order-history:${phone}`);
    }
    console.log(`Order history cache invalidated for ${phone}`);
  } catch (err) {
    console.error("Redis DEL failed (order history)", err);
  }
}

async function invalidateGalleryCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`gallery:images:${businessId}`);
    } else {
      await redisClient.del("gallery:images");
    }
    console.log(`Gallery cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (gallery)", err);
  }
}

async function invalidateCategoryCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`menu:categories:list:${businessId}`);
    } else {
      await redisClient.del("menu:categories:list"); // Fallback
    }
    console.log(`Category cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (categories)", err);
  }
}

async function invalidateHeroCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`hero:content:${businessId}`);
    } else {
      await redisClient.del("hero:content");
    }
    console.log(`Hero cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (hero)", err);
  }
}

async function invalidateLocationCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`location:content:${businessId}`);
    } else {
      await redisClient.del("location:content");
    }
    console.log(`Location cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (location)", err);
  }
}

async function invalidateMenuItemsCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`menu:items:${businessId}`);
    } else {
      await redisClient.del("menu:items");
    }
    console.log(`Menu items cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (menu items)", err);
  }
}

async function invalidatePromotionsCache(businessId) {
  try {
    if (businessId) {
      await redisClient.del(`active_promotion:${businessId}`);
      await redisClient.del(`promotions_list:${businessId}`);
    } else {
      await redisClient.del("active_promotion");
      await redisClient.del("promotions_list");
    }
    console.log(`Promotions cache invalidated for ${businessId || "all"}`);
  } catch (err) {
    console.error("Redis DEL failed (promotions)", err);
  }
}

async function invalidateActiveOrdersHistoryCache(phone, businessId) {
  try {
    if (businessId) {
      await redisClient.del(`active-orders:${phone}:${businessId}`);
    } else {
      await redisClient.del(`active-orders:${phone}`);
    }
    console.log(`Active orders cache invalidated for ${phone}`);
  } catch (err) {
    console.error("Redis DEL failed (active orders)", err);
  }
}

async function invalidateAllBusinessCache(businessId) {
  try {
    if (!businessId) return;
    const allKeys = await redisClient.keys(`*:${businessId}`);
    if (allKeys.length) {
      await redisClient.del(allKeys);
      console.log(`Completely wiped ${allKeys.length} Redis cache keys for business ${businessId}`);
    }
  } catch (err) {
    console.error("Redis DEL failed (all business cache)", err);
  }
}

module.exports = { 
  invalidateDashboardCache, 
  invalidateAdminListCache, 
  invalidateReviewCache, 
  invalidateOrderHistoryCache, 
  invalidateGalleryCache, 
  invalidateCategoryCache, 
  invalidateHeroCache, 
  invalidateLocationCache,
  invalidateMenuItemsCache, 
  invalidatePromotionsCache, 
  invalidateActiveOrdersHistoryCache,
  invalidateAllBusinessCache
};
