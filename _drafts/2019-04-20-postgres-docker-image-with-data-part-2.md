---
published: false
---
Following up on my previous post about creating a docker image with seeded data, I wanted to explore a more real world case where a table might not have just the 100 users we seeded, but millions of rows in it. The idea behind this seeded image is to allow a user to instantly have a database that is ready to be used and a table with millions of rows likely has many indexes on it, however the query planner in a fresh PostgreSQL database has no idea how to use these indexes. Let's imagine for a second that a query is performed right as the database comes up, which should be an index scan, but ends up being a sequential scan; a user would not be very happy when the query ends up taking a significant amount of time. 

I'm going to build on the previous Dockerfile and explore a way to create a new image in which we won't run into the issue of hitting sequential scans right off the bat. But first, let's dive into PostgreSQL to gain a better understanding of how the database manages this issue and what commands are used to ensure that the query planner understands the data that is contained on the table. 

To start off, PostgreSQL manages this issue entirely on own its own through [Routine Vacuuming](https://www.postgresql.org/docs/10/routine-vacuuming.html). However, this process takes time and what we want to accomplish is having a database ready to go the second it starts off; none the less lets take a look at this process.

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

The [ANALYZE](https://www.postgresql.org/docs/10/sql-analyze.html) command is the solution to the issue at hand.

```
ANALYZE collects statistics about the contents of tables in the database, and stores the results in the pg_statistic system catalog. Subsequently, the query planner uses these statistics to help determine the most efficient execution plans for queries.
```

What we also want to understand is the last time that a table has been analyzed and thankfully PostgreSQL provides this data on the `pg_stat_user_tables` VIEW. On the [Monitoring Stats](https://www.postgresql.org/docs/10/monitoring-stats.html) page we can find the info we're interested in

// TODO FIX ME
```
Table 28.13. pg_stat_all_tables View

Column	Type	Description
last_vacuum	timestamp with time zone	Last time at which this table was manually vacuumed (not counting VACUUM FULL)
last_autovacuum	timestamp with time zone	Last time at which this table was vacuumed by the autovacuum daemon
last_analyze	timestamp with time zone	Last time at which this table was manually analyzed
last_autoanalyze	timestamp with time zone	Last time at which this table was analyzed by the autovacuum daemo
```

Now that we know what we're looking for, we can query and look at the tables to get a better understanding of them. The following is a truncated description of the table that was causing issues on our production server and led me down this path.
```
      Table "my_schema.images"
      Column           |            Type
  ---------------------------+-----------------------------
  id                        | integer                     |
  height                    | integer                     |
  width                     | integer                     |
  type                      | character varying           |
   Indexes:
    "images_pkey" PRIMARY KEY, btree (id)
    "index_images_on_type_height_width" btree (type, height, width)
```
I have replicated this table locally and turned off `autovacuum` to demonstrate the issues at hand.

Lets query the table to get the stats on it
```
SELECT 
schemaname || '.' || relname as table_name, 
n_live_tup as row_count, 
last_vacuum, 
last_autovacuum, 
last_analyze, 
last_autoanalyze 
FROM pg_stat_user_tables 
WHERE schemaname = 'vipr' and relname = 'images';

 table_name       | row_count | last_vacuum | last_autovacuum | last_analyze | last_autoanalyze 
------------------+-----------+-------------+-----------------+--------------+------------------
 my_schema.images |  15939607 |             |                 |              | 
(1 row)
```
We can see that the table has nearly 16 million rows and has not been analyzed at all. Lets see what happens when we try to do a query that should result in an index scan.
```


```
