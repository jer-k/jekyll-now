// @flow strict
import React from "react";
import { graphql } from "gatsby";
import Layout from "../components/Layout";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Feed from "../components/Feed";
import Page from "../components/Page";
import Pagination from "../components/Pagination";
import { useSiteMetadata } from "../hooks";
import type { PageContext, AllMarkdownRemark } from "../types";

type Props = {
  data: AllMarkdownRemark,
  pageContext: PageContext,
};

const ThinkingTemplate = ({ data, pageContext }: Props) => {
  const { title: siteTitle, subtitle: siteSubtitle } = useSiteMetadata();

  const {
    currentPage,
    hasNextPage,
    hasPrevPage,
    prevPagePath,
    nextPagePath,
  } = pageContext;

  const { edges } = data.allMarkdownRemark;
  const pageTitle =
    currentPage > 0
      ? `Thinking - Page ${currentPage} - ${siteTitle}`
      : siteTitle;

  return (
    <Layout title={pageTitle} description={siteSubtitle}>
      <Header isIndex />
      <Page>
        <Feed edges={edges} />
        <Pagination
          prevPagePath={prevPagePath}
          nextPagePath={nextPagePath}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
        />
      </Page>
    </Layout>
  );
};

export const query = graphql`
  query ThinkingTemplate($postsLimit: Int!, $postsOffset: Int!) {
    allMarkdownRemark(
      limit: $postsLimit
      skip: $postsOffset
      filter: {
        frontmatter: { template: { eq: "thinking" }, draft: { ne: true } }
      }
      sort: { order: DESC, fields: [frontmatter___date] }
    ) {
      edges {
        node {
          fields {
            slug
            categorySlug
          }
          excerpt(format: HTML, pruneLength: 500)
          frontmatter {
            title
            date
            category
            description
          }
        }
      }
    }
  }
`;

export default ThinkingTemplate;
