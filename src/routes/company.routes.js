const router = require("express").Router();
const controller = require("../controllers/company.controller");
const { authorize } = require("../middleware/roleCheck");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authorize("admin"), controller.create);
router.put("/:id", authorize("admin"), controller.update);
router.delete("/:id", authorize("admin"), controller.delete);

module.exports = router;
