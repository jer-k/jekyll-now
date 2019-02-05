---
published: false
---
Recently, I decided that one of my goals for 2019 was to familiarize myself more with Docker. I've been exposed to using Docker for the past couple of years, but I don't use it on a day to day basis. Every once in awhile I would need to update a Dockerfile or a script and I would realize I needed to brush up on mostly everything because it had been so long since the last time I looked at anything Docker related. I decided I would just dive in and read a book to familiarize myself with any concepts I had glossed over before so I started reading [Learning Docker](). It was during a tutorial where we needed some seeded data in a Postgresql database that I was had a bit of an aha moment. 'We can build images that have data in them already?!' I thought to myself; this could actually really help out on local development if we had a copy of a production database. 

I thought I would put together a quick little tutorial on how you can create a Postgresql Docker image that anyone could use with seeded data.

To start off, I created a new Rails application and generated a migration that created 100 users. You can find the code for that application [here](https://github.com/jer-k/postgres_docker_image_with_data/tree/master/postgres_data) (if you want to follow along using that database, simply replace instances of `my_database_name` in this article with `postgres_data_development`). Once we have the users in the database, we can use [pg_dump](https://www.postgresql.org/docs/10/app-pgdump.html) to create the file needed to seed the database in our image.

```bash
$ pg_dump my_database_name -O -x > my_database_name.sql
```

The `-O -x` flags tell `pg_dump` to have no owner and no privileges so that we can import the data into a new database without worrying about user accounts. You can see the generated `.sql` file from my example project [here](https://github.com/jer-k/postgres_docker_image_with_data/blob/master/pg_data.sql).

Generating a `.sql` file will work, but imagine we have a database much larger than the 100 users I created. A good alternative would be to use [gzip](https://www.gnu.org/software/gzip/) to compress the file and reduce the Docker image size.

```bash
$ pg_dump my_database_name -O -x | gzip -9 > my_database_name.sql.gz
```

Now that we have our compressed database, we're ready to start building our Dockerfile.

```bash
FROM postgres:10.6-alpine
COPY database_name.sql.gz /docker-entrypoint-initdb.d/
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=my_database_name
```

Thats it! As of writing the latest version of [postgres](https://hub.docker.com/_/postgres) 10 is `10.6-alpine`. We simply have to `COPY` our compressed database into the entrypoint directory and then the image understands to unzip it and initialize the database with the dump file. The only other thing needed is to set the environment variables so that we have a user to access the database with.

Lets build our image using the `-t` flag to name the image so we can reference it when we want to run a container with this image.

```bash
$ docker image build -t my_database_image .
```

Then we can run the image using the `-d` flag to run it in detached mode. The last argument `postgres` is the command to start the database.

```bash
$ docker run -d --name my_running_database my_database_image postgres
```

Now we want to ensure that our database is properly running and has the 100 users in it.

```bash
$ docker exec -it my_running_database psql -U postgres my_database_name
postgres_data_development=# select count(*) from users;
 count 
-------
   100
(1 row)
```

And there we have it; we've sucessfully created a Docker image with seeded data that anyone could use. Also, don't forget to stop the container we started earlier!

```bash
$ docker stop my_running_database
```


