---
published: false
---
An update to my post on [adding a testing environment to a gem](https://jer-k.github.io/testing-and-developer-scripts-for-active-record-gem/). After doing some recent updates to our Docker images at work, I realized that we are always using Ruby Alpine images, and not the base Ruby image. I can't remember why I built the gem's Dockerfile using the base Ruby image, perhaps I had just overlooked the fact that we used Ruby Alpine, but I wanted to standardize the Dockerfiles I had written at work and here for the log, so I decided to look into what it would take to do so.

First, why choose an Alpine image? Many other developers have covered this topic in their blog posts and I think it is best not wander down that path again. Instead we'll look at a couple interesting snippets and move onto implementation details.

__"Alpine Linux is a very tiny Linux distribution. It’s built on BusyBox, and it includes only the minimum files needed to boot and run the operating system."__

from Ilija Eftimov's [Build a Minimal Docker Container for Ruby Apps](https://blog.codeship.com/build-minimal-docker-container-ruby-apps/) blog post, which is a great indepth overview about going building a Ruby application from scratch with Docker and Alpine Linux.

__"Debian based base images may be easier to start with but it comes with the cost of image size (Image 2). It is almost six times bigger than image based on Alpine Linux."__

from Lauri Nevala's [Dockerizing Ruby Application](https://ghost.kontena.io/dockerizing-ruby-application/) blog post, which details the different base images that are available for Ruby and again goes through an example of building a Ruby application with Docker and Alpine Linux.

Let's dive into the changes as seen in the [commit](https://github.com/jer-k/gem_with_database/commit/c08c2903310db2acb1bc7e0afda5e69c4e7605ec).

![git diff](https://github.com/jer-k/gem_with_database/blob/master/assets/alpine_changes.png)

To start I changed the image to `ruby:2.5.0-alpine` to use the Ruby Alpine image. Next I'm using [apk](https://wiki.alpinelinux.org/wiki/Alpine_Linux_package_management) to run `apk --update add --no-cache --virtual run-dependencies`. Lets break down the flags I passed to this command. 

`--update`:
Interestingly enough the `--update` flag does not seem to be documented anywhere in the Wiki, but I learned about it from a Gliderlabs' post on [Docker Alpine Usage](http://gliderlabs.viewdocs.io/docker-alpine/usage/). The description they give is __"The --update flag fetches the current package index before adding the package. We don't ship the image with a package index (since that can go stale fairly quickly)."__ Which makes sense as we would want to be able to access the latest packages when our Docker image is created.

`add`:
This is pretty straight forward. From the [docs](https://wiki.alpinelinux.org/wiki/Alpine_Linux_package_management#Add_a_Package).
__"Use add to install packages from a repository. Any necessary dependencies are also installed. If you have multiple repositories, the add command installs the newest package."__

`--no-cache`:
The `apk --help` description for `--no-cache` is __"--no-cache              Do not use any local cache path"__. However, I think the Gliderlabs article did a better job of describing the [functionality](http://gliderlabs.viewdocs.io/docker-alpine/usage/#user-content-disabling-cache).
__"It allows users to install packages with an index that is updated and used on-the-fly and not cached locally."__

`--virtual run-dependencies`:

Now lets go through the packages that we add
```
  bash \
  build-base \
  postgresql-client \
  postgresql-dev \
  git
```

`bash`: 
Bash is added so that we can execute our [wait_for_pg.sh](https://github.com/jer-k/gem_with_database/blob/master/bin/wait_for_pg.sh) script when using `docker-compose` but also so that we can run a shell inside the container via `docker-compose run app /bin/bash`. This is actually a great way to play around with `apk` if you want to try it out!

`build-base`:

`postgresql-client`:
gives us psql

`postgresql-dev`:
needed to install pg

`git`:
Git is needed due to the gemspec using [git ls-files](https://github.com/jer-k/gem_with_database/blob/master/gem_with_database.gemspec#L26-L28).

Thats it!

Also Gliderlabs maintain the [Github repo](https://github.com/gliderlabs/docker-alpine) for the Docker Alpine image if you're interested in looking the source code!