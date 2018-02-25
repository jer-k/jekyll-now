---
published: false
---
In my previous [post](https://jer-k.github.io/connect-to-database-through-gem/) I walked through using a gem to connect to another Rails application's database, but another use case for connecting a gem to a database is for the development the gem. Instead of having to create a Rails application and install the gem to connect to the database to test your models, we can create local database for only the gem.

There will be a lot to go through so I'm going to break this down into two parts: the first being creating the gem and enabling the usage of familiar tasks such as `db:create` and `db:migrate`, the second being setting up the testing environment locally and with Docker for CI purposes.

Lets get started creating the gem!

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
spec.add_development_dependency 'railties', '~> 5'
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

```ruby
# Add the ability to run db:create/migrate/drop etc
require 'yaml'
require 'erb'

require 'active_record'
include ActiveRecord::Tasks

# Load the environment variables for the Postgres user
require 'dotenv'
Dotenv.load('.env')

root = File.expand_path('../..', __FILE__)
DatabaseTasks.root = root
DatabaseTasks.db_dir = File.join(root, 'db')
DatabaseTasks.migrations_paths = [File.join(root, 'db/migrate')]
DatabaseTasks.database_configuration = YAML.load(ERB.new(IO.read(File.join(root, 'config/database.yml'))).result)

# The SeedLoader is Optional, if you don't want/need seeds you can skip setting it
class SeedLoader
  def initialize(seed_file)
    @seed_file = seed_file
  end

  def load_seed
    load @seed_file if File.exist?(@seed_file)
  end
end

DatabaseTasks.seed_loader = SeederLoader.new(File.join(root, 'db/seeds.rb'))

DatabaseTasks.env = ENV['ENV'] || 'development'

task :environment do
  ActiveRecord::Base.configurations = DatabaseTasks.database_configuration
  ActiveRecord::Base.establish_connection(DatabaseTasks.env.to_sym)
end

load 'active_record/railties/databases.rake'
```

Lets walk through what we've done and then we'll try it out! We have to require `yaml` and `erb` so that we can interpret the ERB template in the `database.yml` file and then require `active_record` because it gives access to [ActiveRecord::Tasks](https://github.com/rails/rails/blob/5e4b70461dfd869c7d96b2528e666a9dd8e29183/activerecord/lib/active_record.rb#L156-L164) which gives us access to [ActiveRecord::Tasks::DatabaseTasks](https://github.com/rails/rails/blob/5e4b70461dfd869c7d96b2528e666a9dd8e29183/activerecord/lib/active_record/tasks/database_tasks.rb). Configuring `DatabaseTasks` enables us to run the well known commands such as `rake db:create` or `rake db:migrate`; looking at the [attr_writer](https://github.com/rails/rails/blob/5e4b70461dfd869c7d96b2528e666a9dd8e29183/activerecord/lib/active_record/tasks/database_tasks.rb#L50) properties in `DatabaseTasks` we can get a feel for the properties we need to set.

Load the env vars

First we'll set `root` to the base directory of the gem, this mimics the effects of `Rails.root`, which coincidentally is exactly what the [root](https://github.com/rails/rails/blob/5e4b70461dfd869c7d96b2528e666a9dd8e29183/activerecord/lib/active_record/tasks/database_tasks.rb#L96-L98) method calls. Next we need to set the `db_dir` and we'll do so by mimicing the structure of a Rails project and having the directory be named `db` and live under the root. Continuing to have our setup look like a Rails project we'll create the `db/migrate` directory and set it as the `migrations_paths`; note that its plural so we pass in an `Array` and could specify more than one directory. We'll make use of the aforementioned `YAML` and `ERB` to set the `database_configuration`. The next step is optional, but if we want to be able to use seeds, we have to define a class that responds to [load_seed](https://github.com/rails/rails/blob/5e4b70461dfd869c7d96b2528e666a9dd8e29183/activerecord/lib/active_record/tasks/database_tasks.rb#L281). Following the invocation in `DatabaseTasks` we can see the method definition for [load_seed](https://github.com/rails/rails/blob/6a728491b66340345a91264b5983ad81944ab97a/railties/lib/rails/engine.rb#L549-L552) and base our `SeedLoader` class accordingly; the only thing requirement is to pass a reference to a file, which will be `db/seeds.rb` just as in a Rails project. In preperation for running the tests we'll default the `environment` to `development` unless otherwise specified.




```
$ rake db:create
Created database 'gem_with_database_development'
Created database 'gem_with_database_test'

$ rake db:migrate

$ rake db:drop
Dropped database 'gem_with_database_development'
Dropped database 'gem_with_database_test'
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



