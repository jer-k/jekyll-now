---
published: false
---
In my previous [post](https://jer-k.github.io/connect-to-database-through-gem/) I walked through using a gem to connect to another Rails application's database, but another use case for connecting a gem to a database is for the development the gem. Instead of having to create a Rails application and install the gem to connect to the database to test your models, we can create local database for only the gem.

```
bundler gem gem_with_data
```

First thing we need to do is add our dependencies

```
spec.add_dependency 'activerecord', '~> 5'

spec.add_development_dependency "bundler", "~> 1.15"
spec.add_development_dependency "rake", "~> 10.0"
spec.add_development_dependency "rspec", "~> 3.0"
spec.add_development_dependency 'pg', '~> 0.19'
spec.add_development_dependency 'pry', '~> 0.10'
spec.add_development_dependency 'dotenv', '~> 2.2'
```

Now lets add the ability to use familiar tasks such as `rails db:create` in `support/active_record_rake_tasks/rb`

```
# Setup ActiveRecord tasks for development/test database creation
require 'yaml'
require 'active_record'
require 'erb'
include ActiveRecord::Tasks

root = File.expand_path('../..', __FILE__)
DatabaseTasks.env = ENV['ENV'] || 'development'
DatabaseTasks.database_configuration = YAML.load(ERB.new(IO.read(File.join(root, 'config/database.yml'))).result)
DatabaseTasks.migrations_paths = [File.join(root, 'db/migrate')] #Not actually used, just needs to be set
DatabaseTasks.db_dir = File.join(root, 'spec', 'support')
DatabaseTasks.root = root

task :environment do
  ActiveRecord::Base.configurations = DatabaseTasks.database_configuration
  ActiveRecord::Base.establish_connection(DatabaseTasks.env.to_sym)
end

load 'active_record/railties/databases.rake'
```

blha blah bblah

Now lets make easier for someone to wants to start using the gem by editing `bin/setup`

```
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
set -vx

bundle install

psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='vipr_data'" | grep -q 1 || \
psql postgres --command="create role gem_with_database with superuser login password 'password'"

psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gem_with_database_development'" | grep -q 1 || \
rake db:create
```
