---
published: false
---
Recently, I decided that one of my goals for 2019 was to familiarize myself more with Docker. I've been exposed to using Docker for the past couple of years, but I don't use it on a day to day basis. Every once in awhile I would need to update a Dockerfile or a script and I would realize I needed to brush up on mostly everything because it had been so long since the last time I looked at anything Docker related. I decided I would just dive in and read a book to familiarize myself with any concepts I had glossed over before so I started reading [Learning Docker](). It was during a tutorial where we needed some seeded data in a Postgresql database that I was had a bit of an aha moment. 'We can build images that have data in them already?!' I thought to myself; this could actually really help out on local development if we had a copy of a production database. 

I thought I would put together a quick little tutorial on how you can create a Postgresql Docker image that anyone could use with seeded data.

To start off, I created a new Rails application (using Postgresql) and generated a migration that created 100 users. You can find the code for that application [here](). Once we have the users in the database, we can use [pg_dump]() to create the file needed to seed the database in our image.

```bash
pg_dump database_name -O -x > database_name.sql
```

The `-O -x` flags tell `pg_dump` to have no owner, meaning the dump isn't owned by the user who dumped it and can be used by anyone, and no something whatever -x does. You can see the `.sql` file from my example project [here]().

This will work, but imagine we have a database much larger than the 100 users I created. A good alternative would be to use [gzip]() to compress the file and reduce the Docker image size.

```bash
pg_dump database_name -O -x > database_name.sql | gzip -9 > database_name.sql.gz
```

Now that we have our compressed database, we're ready to start building our Dockerfile.

```
FROM postgres:10.6-alpine
COPY database_name.sql.gz /docker-entrypoint-initdb.d/
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=database_name
```

Thats it! As of writing the latest version of [postgres](https://hub.docker.com/_/postgres) 10 is `10.6-alpine`. We simply have to `COPY` our compressed database into the entrypoint directory and then the postgres image understands to unzip it and initialize the database with the dump file. The only other thing needed is to set the environment variables so that we have a user to access the database with.

Lets build our image

```
docker image build -t database_name_image .
```

We can see Postgresql restoring the database from our zipped file.
```

```

Finally we can run a container with our image and see if we can access our database with data already in it.

```
docker run ... sh
psql -U postgres database_name
<enter password>
select * from users;
...
```

And there we have it; we've sucessfully created a Docker image with seeded data that anyone could use. 

I also included a 'docker-compose.yml' file [here]() to achieve the same effect as the `run` command above.

P.S.
If you're curious about how the postgres image initializes the database I'm going to delve in just a little deeper.
