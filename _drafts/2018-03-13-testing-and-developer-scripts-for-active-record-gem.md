---
published: false
---
Contining to work on our [gem with active_record rake tasks](https://jer-k.github.io/add-active-record-rake-tasks-to-gem/) we still need to test up a testing environment that can be run locally and in a repeatable fashion for continuous integration; we'll accomplish the latter using a simple Dockerfile. But first let's make easier for someone to wants to start using the gem by enhancing the scripts in `bin/`.

We'll start off by changing `bin/setup` to create the user and the database.
```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
set -vx

bundle install

psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='gem_with_database'" | grep -q 1 || \
psql -c "create role gem_with_database with superuser login password 'password'"

psql -tAc "SELECT 1 FROM pg_database WHERE datname='gem_with_database_development'" | grep -q 1 || \
rake db:create db:migrate db:seed
```
The first command queries the `pg_roles` table looking to see if there is a role named `gem_with_database` and returns 1 if so. The result is piped into `grep` looking for the 1, if it is found we stop, otherwise we issue another command to create the `gem_with_database` role. If you're curious as to how this works, `grep` returns a non-zero exit code if it doesn't find something and a bash `||` only evaluates the right hand side of the expression if the left hand side is a non-zero!
We follow the same pattern in the second command and look to see if a database named `gem_with_database_development` exists, if it doesn't we create it and add our data.

Once the database is created and has data in it, we want to start playing around with our models and we can ensure everything is ready by modifying `bin/console`.

```ruby
#!/usr/bin/env ruby

require 'bundler/setup'
require 'gem_with_database'
require 'active_record'
require 'logger'
require 'pry'

ActiveRecord::Base.establish_connection(
  :adapter => 'postgresql',
  :database => 'gem_with_database_development'
)
ActiveRecord::Base.logger = Logger.new(STDOUT)

Pry.start
```
We simply require the needed gems to establish a connection to the database, setup logging so we can see the results of the queries, and my personal preference is to use a `Pry` console. With that a user can clone the repository, run `bin/setup` and then `bin/console` and be able to query data!
```ruby
[1] pry(main)> GemWithDatabase::Book.first
D, [2018-03-10T17:49:22.051607 #31929] DEBUG -- :   GemWithDatabase::Book Load (4.5ms)  SELECT  "books".* FROM "books" ORDER BY "books"."id" ASC LIMIT $1  [["LIMIT", 1]]
=> #<GemWithDatabase::Book:0x00007f8e9cdf6e70
 id: 1,
 title: "A Game of Thrones",
 pages: 694,
 published: 1996,
 author_id: 1>
```

Alright now that we have everyone up and running with a development environment, we need to setup our testing environment. The first thing we will do is add [FactoryBot] so we can create mock data.

```ruby
spec.add_dependency 'factory_bot', `~> 4`
```

It is added as a normal dependency because we can actually export our factories so that anyone who uses the gem gets an added bonus of being able to create mock data right off the bat, instead of having to define their own.

We'll create `lib/gem_with_database/factories/author.rb`.

```ruby
require 'factory_bot'

FactoryBot.define do
  factory :gem_with_database_author, class: GemWithDatabase::Author do
    name 'Test Author'
    age 1
  end
end
```
The name of the factory is prefixed with the name of the gem to ensure that we aren't going to create a collision if someone has already defined a factory named `book` in their application. Now we need to expose the factory in `lib/gem_with_database.rb` and we can move onto setting up our test database.
```
require 'gem_with_database/factories/author'
```

We'll modify `spec/spec_helper.rb` to create a database in the test environment for us to use.
```ruby
ENV['ENV'] = 'test' # Ensure we don't drop the development database

require 'bundler/gem_tasks'
require_relative '../support/active_record_rake_tasks'
task :environment

Rake::Task['db:drop'].invoke
Rake::Task['db:create'].invoke
Rake::Task['db:schema:load'].invoke
```

First and foremost we need to set the `ENV` to `test` to ensure that we're targetting only our test database; remember we set up the `DatabaseTasks.env` to read from `ENV['ENV']`. Then we load the needed files to invoke our rake tasks, stub out the `task :environment` like we did in the `Rakefile`, and create a new database with our schema. Lets write a test for our `Author` class at `spec/models/author_spec.rb` and try it out.

```ruby
require 'spec_helper'

RSpec.describe GemWithDatabase::Author do
  it 'is a test author' do
    author = FactoryBot.create(:gem_with_database_author)
    expect(author.name).to eq('Test Author')
  end
end
```

```bash
$ rspec
Dropped database 'gem_with_database_test'
Created database 'gem_with_database_test'
-- enable_extension("plpgsql")
   -> 0.0392s
-- create_table("authors", {:force=>:cascade})
   -> 0.0093s
-- create_table("books", {:force=>:cascade})
   -> 0.0112s
-- add_foreign_key("books", "authors")
   -> 0.0209s

GemWithDatabase
  has a version number

GemWithDatabase::Author
  is a test author

Finished in 0.02844 seconds (files took 2.13 seconds to load)
2 examples, 0 failures
```

Success! We've created a re-usable database for a testing environment and our tests are passing. The last thing we want to do is setup a way to run our tests in a continuous integration environment so that when the popularity of the gem has exploded and the number of contributors skyrockets, we're able to ensure no one is commiting broken code. We'll do this by creating a `Dockerfile`, utilizing [Docker Compose](https://docs.docker.com/compose/), a few helpful scripts. Also, bear with me, I am by no means an expert with Docker; I've was able to fumble my way through this and get it working. 

First, the `Dockerfile`.
```
FROM ruby:2.5
WORKDIR /usr/src/app/

#Copy the gem files into the WORKDIR
COPY gem_with_database.gemspec .
COPY Gemfile .
COPY lib/gem_with_database/version.rb lib/gem_with_database/

RUN bundle check || bundle install

# Install psql so bin/wait_for_pg.sh will wait for the database to be up and running
# Get the Key
RUN wget --quiet https://www.postgresql.org/media/keys/ACCC4CF8.asc
RUN apt-key add ACCC4CF8.asc
# Add the Source List
RUN echo "deb http://apt.postgresql.org/pub/repos/apt/ precise-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Update and Install
RUN apt-get update && apt-get -y install postgresql-client-9.6

#Copy the project into the WORKDIR
COPY . .
```
The `Dockerfile` looks like a lot, but is pretty straight forward. The `ruby:2.5` image as it is the latest as of writing so we'll use that and we set the `WORKDIR` to `/usr/src/app` because... (Jenkins?) Next we copy in the `.gemspec` file, the `Gemfile` and the `version.rb` as it is referenced in the `.gemspec`. Then we run `bundle check || bundle install` which will check to see if we need to run `bundle install` or not, hopefully saving time and not requiring a full install of all the gems each time we use the container. Next I want to install `postgresl-client` so that we have access to `psql` and can run the `wait_for_pg.sh` script below. I followed the instructions and slightly modified the Docker instructions for installing [Postgresql](https://docs.docker.com/engine/examples/postgresql_service/). Finally we copy in the entire contents of the gem.

The `docker-compose.yml` file is nothing too fancy, besides adding the [entrypoint](https://docs.docker.com/compose/compose-file/compose-file-v2/#entrypoint) which takes in a parameter, the database.
```yaml
version: '2'
services:
  app:
    entrypoint: ./bin/wait_for_pg.sh db
    build: .
    volumes:
      - .:/app
    environment:
      POSTGRES_HOST: db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ''
    depends_on:
      - db
  db:
    image: postgres
    ports:
      - "5432"
```

We'll create a `bin/wait_for_pg.sh` script, which the code was taken from the docker [Control startup order in Compose](https://docs.docker.com/compose/startup-order/) page.
```bash
#!/bin/bash

set -e

host="$1"
shift
cmd="$@"

until psql -h "$host" -U "postgres" -c '\l'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"
exec $cmd
```

Finally we need one last script to run our tests which will be `bin/ci.sh`.
```bash
#!/bin/bash -e

docker-compose build --pull
docker-compose run \
  -e "RAILS_ENV=test" \
  -w "/app" \
  app bundle exec rake spec
```

We tell `docker-compose` to `build` our image and pass `--pull` to ensure it always pulls the most up to date base image. Then we tell `docker-compose` to `run` `app bundle exec rake spec`, using `-e` to pass an environment variable of `RAILS_ENV=test`, and `-w` to indicate the work dir (which is . We can now run `bin/ci.sh` and we should see Docker build everything and run our tests!