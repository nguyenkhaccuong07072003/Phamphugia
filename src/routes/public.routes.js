const router = require("express").Router();
const homepage = require("../controllers/homepage.controller");
const digitization = require("../controllers/digitization.controller");
const company = require("../controllers/company.controller");
const chat = require("../controllers/chat.controller");

// Aggregated homepage data
router.get("/homepage", homepage.getHomepage);

// Individual endpoints
router.get("/departments", homepage.getDepartments);
router.get("/companies", company.getPublicList);
router.get("/slides", homepage.getSlides);
router.get("/news/sidebar", homepage.getSidebarNews);
router.get("/news/highlight", homepage.getHighlightNews);
router.get("/news/grid", homepage.getGridNews);
router.get("/news/grouped-by-category", homepage.getNewsGroupedByCategory);
router.get("/news/all", homepage.getAllNews);
router.get("/news/related/:slug", homepage.getRelatedNews);
router.get("/news/:slug", homepage.getNewsBySlug);
router.get("/pages/:slug", homepage.getPageBySlug);
router.get("/pages/:deptSlug/:slug", homepage.getPageByDeptAndSlug);
router.get("/social-links", homepage.getSocialLinks);
router.get("/offices", homepage.getOffices);
router.get("/settings", homepage.getSettings);
router.get("/visitors/count", homepage.getVisitorCount);
router.post("/visitors/track", homepage.trackVisitor);

router.post("/chat", chat.chat);

// Digitization (public)
router.get("/digitization/templates", digitization.getPublicTemplates);
router.get(
  "/digitization/templates/:slug",
  digitization.getPublicTemplateBySlug,
);

module.exports = router;
