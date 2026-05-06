exports.successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

exports.paginatedResponse = (res, data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json({
    success: true,
    data,
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
};
