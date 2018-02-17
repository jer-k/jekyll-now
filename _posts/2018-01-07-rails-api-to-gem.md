---
layout: post
title: Turn a Rails API into a Gem
published: false
---
 
Turn a Rails API into a Gem
Or How to Connect Rails to Multiple Databases and Setup ActiveRecord (with a test environment) in a Gem

Intro: <Coming Soon>

Disclaimer: I’m assuming the reader has general knowledge of the Rails ecosystem and minor things, such as running `bundle install`, do not need explicit instructions. Also prior knowledge of creating gems (if not, I highly recommend reading [https://bundler.io/v1.13/guides/creating_gem.html](https://bundler.io/v1.13/guides/creating_gem.html) first)

If you would like to download the code beforehand it is located at [https://github.com/jer-k/api_to_gem](https://github.com/jer-k/api_to_gem). If you want to skip running the commands to setup a couple vanilla rails apps I would suggest downloading the code, running rails db:setup on both and skipping ahead to #somewhere

Let's get start by creating an API that we'll eventually want to access through a gem, instead of via HTTP requests. 
```
> rails new books_api
```
In `Gemfile` I'm swapping out `sqlite3` for `pg` as I work with Postgresql every day. I'll be running commands for `psql` from here on out, but feel free to use whatever database you feel most comfortable with. With that said, I'm changing the `config/database.yml` to look like:
```
default: &default
  adapter: postgresql
  encoding: unicode
  pool: 5
  host: localhost
  port: 5432

local: &local
  username: <%= ENV['POSTGRES_USER'] %>
  password: <%= ENV['POSTGRES_PASSWORD'] %>

development:
  <<: *default
  <<: *local
  database: books_api_development

test:
  <<: *default
  <<: *local
  database: books_api_test
```
Since we're adding a configurable user and password, I'm going to add the [DotEnv](https://github.com/bkeepers/dotenv) gem to set those environment variables
```
gem 'dotenv-rails'
```
and create the `.env` file.
```
POSTGRES_USER=books_api
POSTGRES_PASSWORD=password
```
Then we'll need to create the user who controls the database and create it.
```
> psql postgres --command="create role books_api with superuser login password 'password'"
> rails db:create
```
Now we'll generate a migration to create a couple very basic tables.
```
> rails g migration create_books_and_authors

class CreateBooksAndAuthors < ActiveRecord::Migration[5.1]
  def change
    create_table :authors do |t|
      t.string :name
      t.integer :age

      t.timestamps
    end

    create_table :books do |t|
      t.string :title
      t.integer :pages
      t.integer :published

      t.references :author

      t.timestamps
    end
  end
end

> rails db:migrate
```
The last step to setting up our data will be to seed the tables.
```
george = Author.find_or_create_by(name: "George R.R. Martin", age: 67)

[
  {title: "A Game of Thrones", pages: 694, published: 1996, author: george},
  {title: "A Clash of Kings", pages: 768, published: 1998, author: george},
  {title: "A Storm of Swords", pages: 973, published: 2000, author: george},
  {title: "A Feast for Crows", pages: 753, published: 2005, author: george},
  {title: "A Dance with Dragons", pages: 1004, published: 2012, author: george}
].each do |book|
  Book.find_or_create_by(book)
end

jk = Author.find_or_create_by(name: "J.K. Rowling", age: 50)

[
  {title: "Harry Potter and the Sorcerer's Stone", pages: 309, published: 1997, author: jk},
  {title: "Harry Potter and the Chamber Of Secrets", pages: 341, published: 1998, author: jk},
  {title: "Harry Potter and the Prisoner of Azkaban", pages: 435, published: 1999, author: jk},
  {title: "Harry Potter and the Goblet of Fire", pages: 734, published: 2000, author: jk},
  {title: "Harry Potter and the Order of the Phoenix", pages: 870, published: 2003, author: jk},
  {title: "Harry Potter and the Half-Blood Prince", pages: 652, published: 2005, author: jk},
  {title: "Harry Potter and the Deathly Hallows", pages: 759, published: 2007, author: jk}
].each do |book|
  Book.find_or_create_by(book)
end

> rails db:seed
```



Hurray! We’ve successfully connected to our API, but wait, if you’re asking yourself wasn’t the point of this exercise to not be using an API, you would be correct. Why would we not use an API though? Well our contrived example will be that the Santa Monica Library does not carry the Harry Potter books and the books_api currently doesn’t allow you to look for books for a given author. Oh don't forget by some strange and mysterious magic, books_api can no longer be updated!

The way we are going to resolve this is by creating a gem which will expose the classes in `books_api`’s database and take in environment variables telling it where the database lives, in effect connecting `library_system` to multiple databases.

Let's get started with creating our gem, the classes, and adding it to the `library_system` project.
```
bundle gem books_gem
```
and then we’ll need to add ActiveRecord as a dependency to the `books_gem.gemspec`.

```
 spec.add_dependency 'activerecord', '~> 5'
```

Next we’ll create a base class at `lib/books_gem/models/base.rb`.
```
require 'active_record'

module BooksGem
  class Base < ::ActiveRecord::Base
    self.abstract_class = true
    establish_connection(BOOKS_GEM_DB[Rails.env])
  end
end
```

The [establish_connection](http://api.rubyonrails.org/classes/ActiveRecord/ConnectionHandling.html#method-i-establish_connection) call allows us to tell `ActiveRecord` how, and where, we're going to connect to a database. Since this is our base class, the connection will only be established once, and all our subclasses will know where their database resides. If you would like to read more about why you should only establish a single connection, Sophie DeBenedetto wrote a great blog post, [Managing Multiple Databases in a Single Rails Application](http://www.thegreatcodeadventure.com/managing-multiple-databases-in-a-single-rails-application/), going much further in depth on that topic than I am here. Kudos to her, she provided much of the inspiration for my work on this idea. 

Since this is a gem, we want our connection to be configurable for anyone who uses it. The BOOKS_API_DB constant will provide this configurability, which we'll create at `lib/books_gem/db/books_gem_db.rb`.
```
require 'yaml'
require 'erb'

this_file_path = File.expand_path('../', __FILE__)
BOOKS_GEM_DB = YAML.load(ERB.new(IO.read(File.join(this_file_path, 'books_gem_database.yml'))).result)

```
What we're doing here is getting the full filepath for the `books_gem_db.rb` file and then reading its contents into an ERB object. As you'll see below, we're using ERB templating in the YAML file to read environment variables that tell us where the database resides and how to connect to it. And then finally we load the YAML and save it into the `BOOKS_GEM_DB` constant.

The YAML file will be located at `lib/books_gem/db/books_gem_database.yml`.
```
default: &default
  adapter: postgresql
  encoding: unicode
  pool: 5
  port: 5432

local: &local
  host: <%= ENV['BOOKS_GEM_DB_HOST'] %>
  username: <%= ENV['BOOKS_GEM_DB_USER'] %>
  password: <%= ENV['BOOKS_GEM_DB_PASSWORD'] %>

development:
  <<: *default
  <<: *local
  database: <%= ENV['BOOKS_GEM_DB_DEVELOPMENT'] %>

test:
  <<: *default
  <<: *local
  database: <%= ENV['BOOKS_GEM_DB_TEST'] %>
```

We still need to create our subclasses
```
module BooksGem
  class Book < Base
  end
end
```
```
module BooksGem
  class Author < Base
  end
end
```
and finally we need to expose all our classes in `lib/books_gem.rb`.
```
require "books_gem/version"

require 'books_gem/db/books_gem_db'
require 'books_gem/models/base'
require 'books_gem/models/book'
require 'books_gem/models/author'
```

Alright, we made it through getting everything setup. Lets see if we can talk to the `books_api` database from `library_system`! I'm not going to worry about publishing the gem and instead just install the local version.
```
gem 'books_gem', path: '<path/to>/books_gem'
```
We need to provide the required environment variables. The reasoning behind using needing `dotenv/rails-now` should now be apparent. We must force DotEnv to load before our gem to ensure that the environment variables are accessible.
```
BOOKS_GEM_DB_HOST=localhost
BOOKS_GEM_DB_USER=
BOOKS_GEM_DB_PASSWORD=
BOOKS_GEM_DB_DEVELOPMENT=books_api_development
BOOKS_GEM_DB_TEST=books_api_test
```
Lets try it out!
```
[1] pry(main)> BooksGem::Author.first
  BooksGem::Author Load (1.9ms)  SELECT  "authors".* FROM "authors" ORDER BY "authors"."id" ASC LIMIT $1  [["LIMIT", 1]]
=> #<BooksGem::Author:0x007fc72d3980e0
 id: 1,
 name: "George R.R. Martin",
 age: 67,
 created_at: Sun, 07 Jan 2018 22:23:00 UTC +00:00,
 updated_at: Sun, 07 Jan 2018 22:23:00 UTC +00:00>
```
Success!! We've connected to the `books_api` database and are able to query it! Why did we do all this again? Oh yeah because we wanted to able to return books that aren't Harry Potter; let's wrap that up and call it a day.

```
```

After getting all this setup, we can look to enhance the capabilities that the `books_gem` offers, such as a local database for gem development and unit tests for new model methods. We can also enhance the installation and setup through generators when `books_gem` is brought into a new project. Be on the lookout for [Part 2]() of this series.
