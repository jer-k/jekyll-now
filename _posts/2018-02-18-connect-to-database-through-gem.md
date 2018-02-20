---
published: false
---
I was recently thinking about system design, specifically the monolithic vs microservices approaches and how applications can talk to each other. I'm guessing that two applications talking to each other over HTTP requests through an exposed API would be the easiest place to start for setting up microservices architecture. However, sometimes maintaining APIs can be a real hassle (adding new fields, bloated payloads, versioning, etc) and an idea popped into my head to allow clients to connect directly to the database of the other application and request data as they see fit. This obviously could only be used for internal applications and could totally cripple your system if a client starts writing queries without knowning what they are doing, but I was curious and wanted to try it out so let's get started with creating our gem!

```ruby
bundle gem books_gem
```

We’ll need to add ActiveRecord as a dependency to the `books_gem.gemspec`.

```ruby
 spec.add_dependency 'activerecord', '~> 5'
```

Next we’ll create a base class at `lib/books_gem/models/base.rb`.
```ruby
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
```ruby
require 'yaml'
require 'erb'

this_file_path = File.expand_path('../', __FILE__)
BOOKS_GEM_DB = YAML.load(ERB.new(IO.read(File.join(this_file_path, 'books_gem_database.yml'))).result)

```
What we're doing here is getting the full filepath for the `books_gem_db.rb` file and then reading its contents into an ERB object. As you'll see below, we're using ERB templating in the YAML file to read environment variables that tell us where the database resides and how to connect to it. Finally we load the YAML and save it into the `BOOKS_GEM_DB` constant.

The YAML file will be located at `lib/books_gem/db/books_gem_database.yml`.
```yaml
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
```ruby
module BooksGem
  class Book < Base
  end
end
```
```ruby
module BooksGem
  class Author < Base
  end
end
```
and finally we need to expose all our classes in `lib/books_gem.rb`.
```ruby
require "books_gem/version"

require 'books_gem/db/books_gem_db'
require 'books_gem/models/base'
require 'books_gem/models/book'
require 'books_gem/models/author'
```

That concludes writing the gem. There is an example project located at [https://github.com/jer-k/api_to_gem](https://github.com/jer-k/api_to_gem) with instructions in the [README](https://github.com/jer-k/api_to_gem/blob/master/README.md) on how to test out the gem. There is one last gotcha, which is ensuring that the environment variables from the Rails application are available when the gem loads. I perfer to use [Dotenv](https://github.com/bkeepers/dotenv) and we would install it using the `rails-now` preference
```ruby
gem 'dotenv-rails', require: 'dotenv/rails-now'
gem 'books_gem', path: path/to/books_gem
```

Then we can set our environment variables in the Rails application and be done.
```ruby
BOOKS_GEM_DB_HOST=localhost
BOOKS_GEM_DB_USER=books_gem_user
BOOKS_GEM_DB_PASSWORD=password
BOOKS_GEM_DB_DEVELOPMENT=books_api_development
BOOKS_GEM_DB_TEST=books_api_test
```

We've successfully connected to another application's database and are free to write queries to our hearts content
