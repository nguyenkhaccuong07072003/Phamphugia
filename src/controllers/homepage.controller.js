const {
  Department,
  SubMenuItem,
  NewsArticle,
  NewsCategory,
  User,
  Banner,
  Office,
  SocialLink,
  SiteSetting,
  VisitorsLog,
} = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/response");

/** Giới hạn số bài slider (homepage + API slides) — tránh trả quá nhiều dòng. */
const SLIDER_NEWS_LIMIT = 30;

// GET /api/public/homepage - Aggregated homepage data
exports.getHomepage = asyncHandler(async (req, res) => {
  const [
    banner,
    slides,
    departments,
    normalNewsRows,
    highlightNews,
    socialLinks,
    offices,
    settings,
  ] = await Promise.all([
    // Active banner
    Banner.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    }),

    // Slider news (from news articles with is_slider=true)
    NewsArticle.findAll({
      where: { is_published: true, is_slider: true },
      attributes: [
        "id",
        "title",
        "slug",
        "thumbnail_url",
        "image_urls",
        "slider_sort_order",
        "published_at",
      ],
      include: [
        { model: NewsCategory, as: "category", attributes: ["id", "name"] },
      ],
      order: [
        ["slider_sort_order", "ASC"],
        ["published_at", "DESC"],
      ],
      limit: SLIDER_NEWS_LIMIT,
    }),

    // Departments with sub-menus (nested)
    Department.findAll({
      where: { is_active: true },
      include: [
        {
          model: SubMenuItem,
          as: "subMenuItems",
          where: { is_active: true, parent_id: null },
          required: false,
          include: [
            {
              model: SubMenuItem,
              as: "children",
              where: { is_active: true },
              required: false,
            },
          ],
        },
      ],
      order: [
        ["sort_order", "ASC"],
        [{ model: SubMenuItem, as: "subMenuItems" }, "sort_order", "ASC"],
      ],
    }),

    // Tin normal (25): một query cho cả sidebar + grid — tránh hai truy vấn trùng điều kiện
    NewsArticle.findAll({
      where: { is_published: true },
      attributes: [
        "id",
        "title",
        "slug",
        "thumbnail_url",
        "image_urls",
        "published_at",
      ],
      include: [
        { model: NewsCategory, as: "category", attributes: ["id", "name"] },
      ],
      order: [["published_at", "DESC"]],
      limit: 25,
    }),

    // Highlight news (4)
    NewsArticle.findAll({
      where: { is_published: true, is_highlight: true },
      attributes: [
        "id",
        "title",
        "slug",
        "thumbnail_url",
        "image_urls",
        "published_at",
      ],
      include: [
        { model: NewsCategory, as: "category", attributes: ["id", "name"] },
      ],
      order: [["published_at", "DESC"]],
      limit: 4,
    }),

    // Social links grouped by platform
    SocialLink.findAll({
      where: { is_active: true },
      order: [["sort_order", "ASC"]],
    }),

    // Active offices
    Office.findAll({
      where: { is_active: true },
      order: [["sort_order", "ASC"]],
    }),

    // All site settings as key-value (gồm visitor_count — không query thêm)
    SiteSetting.findAll(),
  ]);

  const sidebarNews = normalNewsRows.map((r) => {
    const j = r.get({ plain: true });
    return {
      id: j.id,
      title: j.title,
      slug: j.slug,
      published_at: j.published_at,
    };
  });
  const gridNews = normalNewsRows;

  // Group social links by platform
  const groupedSocialLinks = {
    website: socialLinks.filter((l) => l.platform === "website"),
    facebook: socialLinks.filter((l) => l.platform === "facebook"),
    zalo: socialLinks.filter((l) => l.platform === "zalo"),
  };

  // Convert settings to key-value map
  const settingsMap = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  const visitorCount = settingsMap.visitor_count
    ? parseInt(settingsMap.visitor_count, 10)
    : 0;

  return successResponse(res, {
    banner,
    slides,
    departments,
    sidebarNews,
    highlightNews,
    gridNews,
    socialLinks: groupedSocialLinks,
    offices,
    settings: settingsMap,
    visitorCount: Number.isFinite(visitorCount) ? visitorCount : 0,
  });
});

// GET /api/public/departments
exports.getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.findAll({
    where: { is_active: true },
    include: [
      {
        model: SubMenuItem,
        as: "subMenuItems",
        where: { is_active: true, parent_id: null },
        required: false,
        include: [
          {
            model: SubMenuItem,
            as: "children",
            where: { is_active: true },
            required: false,
          },
        ],
      },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: SubMenuItem, as: "subMenuItems" }, "sort_order", "ASC"],
    ],
  });

  return successResponse(res, departments);
});

// GET /api/public/slides
exports.getSlides = asyncHandler(async (req, res) => {
  const slides = await NewsArticle.findAll({
    where: { is_published: true, is_slider: true },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "slider_sort_order",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
    ],
    order: [
      ["slider_sort_order", "ASC"],
      ["published_at", "DESC"],
    ],
    limit: SLIDER_NEWS_LIMIT,
  });

  return successResponse(res, slides);
});

// GET /api/public/news/sidebar
exports.getSidebarNews = asyncHandler(async (req, res) => {
  const news = await NewsArticle.findAll({
    where: { is_published: true },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name", "sort_order"] },
    ],
    order: [
      [{ model: NewsCategory, as: "category" }, "sort_order", "ASC"],
      ["published_at", "DESC"]
    ],
    limit: 25,
  });

  return successResponse(res, news);
});

// GET /api/public/news/highlight
exports.getHighlightNews = asyncHandler(async (req, res) => {
  const news = await NewsArticle.findAll({
    where: { is_published: true, is_highlight: true },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
    ],
    order: [["published_at", "DESC"]],
    limit: 4,
  });

  return successResponse(res, news);
});

// GET /api/public/news/grid
exports.getGridNews = asyncHandler(async (req, res) => {
  const news = await NewsArticle.findAll({
    where: { is_published: true },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
    ],
    order: [["published_at", "DESC"]],
    limit: 25,
  });

  return successResponse(res, news);
});

// GET /api/public/news/grouped-by-category
exports.getNewsGroupedByCategory = asyncHandler(async (req, res) => {
  const categories = await NewsCategory.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"], ["created_at", "ASC"]],
  });

  const result = [];
  for (const cat of categories) {
    const items = await NewsArticle.findAll({
      where: {
        category_id: cat.id,
        is_published: true,
      },
      attributes: [
        "id",
        "title",
        "slug",
        "thumbnail_url",
        "image_urls",
        "published_at",
      ],
      order: [["published_at", "DESC"]],
      limit: 50,
    });
    
    if (items.length > 0) {
      result.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        items,
      });
    }
  }

  return successResponse(res, result);
});

// GET /api/public/news/all
exports.getAllNews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { count, rows } = await NewsArticle.findAndCountAll({
    where: { is_published: true },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
    ],
    order: [["published_at", "DESC"]],
    limit,
    offset,
  });

  return successResponse(res, {
    items: rows,
    page,
    totalPages: Math.ceil(count / limit),
    totalItems: count,
  });
});

// GET /api/public/news/:slug
exports.getNewsBySlug = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findOne({
    where: { slug: req.params.slug, is_published: true },
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
      {
        model: User,
        as: "author",
        attributes: ["id", "full_name", "avatar_url"],
      },
      { model: Department, as: "department", attributes: ["id", "name"] },
    ],
  });

  if (!article) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(404, "Article not found");
  }

  // Increment view count
  await article.increment("view_count");

  return successResponse(res, article);
});

// GET /api/public/news/:slug/related
exports.getRelatedNews = asyncHandler(async (req, res) => {
  const article = await NewsArticle.findOne({
    where: { slug: req.params.slug, is_published: true },
    attributes: ["id", "category_id"],
  });

  if (!article) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(404, "Article not found");
  }

  const { Op } = require("sequelize");
  const related = await NewsArticle.findAll({
    where: {
      category_id: article.category_id,
      id: { [Op.ne]: article.id },
      is_published: true,
    },
    attributes: [
      "id",
      "title",
      "slug",
      "thumbnail_url",
      "image_urls",
      "published_at",
    ],
    include: [
      { model: NewsCategory, as: "category", attributes: ["id", "name"] },
    ],
    order: [["published_at", "DESC"]],
    limit: 10,
  });

  return successResponse(res, related);
});

// GET /api/public/pages/:slug
exports.getPageBySlug = asyncHandler(async (req, res) => {
  const item = await SubMenuItem.findOne({
    where: { slug: req.params.slug, is_active: true },
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name", "slug"],
      },
    ],
  });

  if (!item) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(404, "Page not found");
  }

  return successResponse(res, item);
});

// GET /api/public/pages/:deptSlug/:slug
exports.getPageByDeptAndSlug = asyncHandler(async (req, res) => {
  const { deptSlug, slug } = req.params;

  const item = await SubMenuItem.findOne({
    where: { slug, is_active: true },
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name", "slug"],
        where: { slug: deptSlug },
      },
    ],
  });

  if (!item) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(404, "Page not found");
  }

  return successResponse(res, item);
});

// GET /api/public/social-links
exports.getSocialLinks = asyncHandler(async (req, res) => {
  const links = await SocialLink.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"]],
  });

  const grouped = {
    website: links.filter((l) => l.platform === "website"),
    facebook: links.filter((l) => l.platform === "facebook"),
    zalo: links.filter((l) => l.platform === "zalo"),
  };

  return successResponse(res, grouped);
});

// GET /api/public/offices
exports.getOffices = asyncHandler(async (req, res) => {
  const offices = await Office.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"]],
  });

  return successResponse(res, offices);
});

// GET /api/public/settings
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await SiteSetting.findAll();
  const settingsMap = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return successResponse(res, settingsMap);
});

// GET /api/public/visitors/count
exports.getVisitorCount = asyncHandler(async (req, res) => {
  const setting = await SiteSetting.findOne({
    where: { key: "visitor_count" },
  });
  const count = setting ? parseInt(setting.value) : 0;

  return successResponse(res, { count });
});

// POST /api/public/visitors/track
exports.trackVisitor = asyncHandler(async (req, res) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const userAgent = req.headers["user-agent"] || null;
  const pageUrl = req.body.page_url || req.originalUrl;

  await VisitorsLog.create({
    ip_address: ip,
    user_agent: userAgent,
    page_url: pageUrl,
  });

  // Increment visitor count in settings
  const setting = await SiteSetting.findOne({
    where: { key: "visitor_count" },
  });
  if (setting) {
    await setting.update({ value: String(parseInt(setting.value) + 1) });
  }

  return successResponse(res, null, "Visit tracked");
});
