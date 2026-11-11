const buildPagination = (req) => {
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 10;

    page = Math.max(page, 1);
    limit = Math.min(Math.max(limit, 1), 100);

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};


const buildSort = (
    sort,
    defaultSort = "-createdAt"
) => {
    const allowedSorts = [
        "createdAt",
        "-createdAt",
        "updatedAt",
        "-updatedAt",
        "price",
        "-price",
        "rating",
        "-rating",
        "budget",
        "-budget",
        "title",
        "-title"
    ];

    if (
        sort &&
        allowedSorts.includes(sort)
    ) {
        return sort;
    }

    return defaultSort;
};


module.exports = {
    buildPagination,
    buildSort
};