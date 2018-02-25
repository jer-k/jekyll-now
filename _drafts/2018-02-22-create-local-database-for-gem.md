---
published: false
---
In my previous [post](https://jer-k.github.io/connect-to-database-through-gem/) I walked through using a gem to connect to another Rails application's database, but another use case for connecting a gem to a database is for the development the gem. Instead of having to create a Rails application and install the gem to connect to the database to test your models, we can create local database for only the gem.

```ruby
bundler gem gem_with_data
```

First thing we need to do is add the dependencies to `gem_with_data.gemspec`.

```ruby
spec.add_dependency 'activerecord', '~> 5'

spec.add_development_dependency "bundler", "~> 1.15"
spec.add_development_dependency "rake", "~> 10.0"
spec.add_development_dependency "rspec", "~> 3.0"
spec.add_development_dependency 'pg', '~> 0.19'
spec.add_development_dependency 'pry', '~> 0.10'
spec.add_development_dependency 'dotenv', '~> 2.2'
```

We know that we're going to need to configure the database so we'll go ahead and create `config/database.yml` and `.env` to allow us flexibility in our configuration.
```ruby
#config/database.yml

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
  database: gem_with_database_development

test:
  <<: *default
  <<: *local
  database: gem_with_database_test
```

```ruby
#.env

POSTGRES_USER=gem_with_database
POSTGRES_PASSWORD=password
```

If you're going to use the above user, make sure it exists by running the following command.
```bash
$ psql postgres --command="create role gem_with_database with superuser login password 'password'"
```

Now we can create `support/active_record_rake_tasks.rb` to configure `ActiveRecord::Tasks::DatabaseTasks` allowing us to use the familiar database tasks we know from Rails applications such as `rake db:create`.

```
# Adapted from https://stackoverflow.com/questions/19206764/how-can-i-load-activerecord-database-tasks-on-a-ruby-project-outside-rails/26046277#26046277
#
# Added the ability to specify the database configuration with ERB templates
require 'yaml'
require 'erb'

require 'active_record'
include ActiveRecord::Tasks

class Seeder
  def initialize(seed_file)
    @seed_file = seed_file
  end

  def load_seed
    raise "Seed file '#{@seed_file}' does not exist" unless File.file?(@seed_file)
    load @seed_file
  end
end

# Load the environment variables for the Postgres user
require 'dotenv'
Dotenv.load('.env')

root = File.expand_path('../..', __FILE__)
DatabaseTasks.env = ENV['ENV'] || 'development'
DatabaseTasks.database_configuration = YAML.load(ERB.new(IO.read(File.join(root, 'config/database.yml'))).result)
DatabaseTasks.migrations_paths = [File.join(root, 'db/migrate')]
DatabaseTasks.seed_loader = Seeder.new(File.join(root, 'db/seeds.rb'))
DatabaseTasks.db_dir = File.join(root, 'db')
DatabaseTasks.root = root

task :environment do
  ActiveRecord::Base.configurations = DatabaseTasks.database_configuration
  ActiveRecord::Base.establish_connection(DatabaseTasks.env.to_sym)
end

load 'active_record/railties/databases.rake'
```

First lets walk through what we've done and then we'll try it out!


```
$ rake db:create
$ rake db:migrate
$ rake db:drop
```

I was able to run `rake db:migrate` but we don't actually have any migrations yet; unfortunately `rails generate` is not available to us and I don't want to bring in the entirety of Rails so we're going to have to create this ability ourselves.

```

```

Now lets make easier for someone to wants to start using the gem by editing `bin/setup`.

```
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
set -vx

bundle install

psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='gem_with_database'" | grep -q 1 || \
psql postgres --command="create role gem_with_database with superuser login password 'password'"

psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gem_with_database_development'" | grep -q 1 || \
rake db:create db:migrate db:seed
```
Once the database is created and has data in it, we want to start playing around with out models and we can ensure everything is ready by modifying `bin/console`.

```
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

```
# Show a query
```

The last thing we want to do is ensure that we can write tests and run them because no one likes untested code!



