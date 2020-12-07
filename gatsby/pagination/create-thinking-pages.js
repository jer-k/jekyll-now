"use strict";

const path = require("path");
const siteConfig = require("../../config.js");

module.exports = async (graphql, actions) => {
  const { createPage } = actions;

  const result = await graphql(`
    {
      allMarkdownRemark(
        filter: {
          frontmatter: { template: { eq: "thinking" }, draft: { ne: true } }
        }
      ) {
        totalCount
      }
    }
  `);

  const { postsPerPage } = siteConfig;
  const numPages = Math.ceil(
    result.data.allMarkdownRemark.totalCount / postsPerPage
  );

  for (let i = 0; i < numPages; i += 1) {
    createPage({
      path: i === 0 ? "/thinking" : `thinking/page/${i}`,
      component: path.resolve("./src/templates/thinking-template.js"),
      context: {
        currentPage: i,
        postsLimit: postsPerPage,
        postsOffset: i * postsPerPage,
        prevPagePath: i <= 1 ? "/thinking" : `/thinking/page/${i - 1}`,
        nextPagePath: `/thinking/page/${i + 1}`,
        hasPrevPage: i !== 0,
        hasNextPage: i !== numPages - 1,
      },
    });
  }
};
