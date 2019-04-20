---
published: false
---
Following up on my previous post about creating a docker image with seeded data, I wanted to explore a more real world case where a table might not have just the 100 users we seeded, but millions of rows in it. The idea behind this seeded image is to allow a user to instantly have a database that is ready to be used and a table with millions of rows likely has many indexes on it, however the query planner in a fresh PostgreSQL database has no idea how to use these indexes. Let's imagine for a second that a query is performed right as the database comes up, which should be an index scan, but ends up being a sequential scan; a user would not be very happy when the query ends up taking a significant amount of time. 

I'm going to build on the previous Dockerfile and explore a way to create a new image in which we won't run into the issue of hitting sequential scans right off the bat.

First off lets dive into PostgreSQL a little bit and cover how PostgreSQL manages this issue own its own through [Routine Vacuuming](https://www.postgresql.org/docs/10/routine-vacuuming.html).

```
PostgreSQL databases require periodic maintenance known as vacuuming. For many installations, it is sufficient to let vacuuming be performed by the autovacuum daemon, which is described in Section 24.1.6.
```

In the first section of the Rountine Vacuuming document, a nice list of tasks the vacuuming performs is listed.

```
24.1.1. Vacuuming Basics
PostgreSQL's VACUUM command has to process each table on a regular basis for several reasons:

1. To recover or reuse disk space occupied by updated or deleted rows.
2. To update data statistics used by the PostgreSQL query planner.
3. To update the visibility map, which speeds up index-only scans.
4. To protect against loss of very old data due to transaction ID wraparound or multixact ID wraparound.
Each of these reasons dictates performing VACUUM operations of varying frequency and scope, as explained in the following subsections.
```

Point two hits the nail on the head of what needs to be accomplished and we can find out more about this further down the Routine Vacuuming page.

```
24.1.3. Updating Planner Statistics
The PostgreSQL query planner relies on statistical information about the contents of tables in order to generate good plans for queries. These statistics are gathered by the ANALYZE command, which can be invoked by itself or as an optional step in VACUUM. It is important to have reasonably accurate statistics, otherwise poor choices of plans might degrade database performance.

The autovacuum daemon, if enabled, will automatically issue ANALYZE commands whenever the content of a table has changed sufficiently.
```

The [ANALYZE](https://www.postgresql.org/docs/10/sql-analyze.html) command is described as

```
ANALYZE collects statistics about the contents of tables in the database, and stores the results in the pg_statistic system catalog. Subsequently, the query planner uses these statistics to help determine the most efficient execution plans for queries.
```

and is the solution to the issue at hand.

I happen to have a database with a table of 15 million or so rows on hand so I'm going to demonstrate the issue of

