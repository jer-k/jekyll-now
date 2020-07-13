---
published: false
---
Creating a Build server with Elixir, Docker Buildx, and Kubernetes

Overview:
Intro
Reasoning behind each technology
Elixir
Faktory : faktory_worker
Broadway
Buildx
Distributed caching
Bake -> docker-compose
Kubernetes
Easy to scale up
Explaining core code pieces
Dockerfile to get things up
Creating the builders
Running the build
Capacity testing
What is the throughput on the Phoenix server
What is the throughput on the builder nodes

I’ve been toying around with Elixir since I first heard about in 2015 but that’s mostly been it, just toying. With the onset of coronavirus and the shelter in place measures I found myself with a lot of extra time so far this year due to the fact that I live alone and my gym was closed. I used to work out in the mornings but since I couldn’t, and I’m not motivated enough to move my furniture to make space in my apartment every morning, I decided I wanted to use my mornings before work to really try to build something meaningful in Elixir. I’ve been getting more interested in DevOps related programming, particularly Docker builds. After attending DockerCon last year, I was encouraged to write [My First Ten Years; My Next Ten Years](https://jer-k.github.io/first-ten-years-next-ten-years/) where I expressed this interest “Another area I have a lot of interest in is DevOps / Docker / Go… Recently I started spending more reading and learning about Docker and I feel that the containerization movement will continue to grow.” What I set out to build was a Docker build system that would be performant and highly scalable. I decided I wanted to share that journey and a subset of the code I’ve written. If you want to see the full repository you can find it [here]() or jump ahead to the [the code]() if you don’t want to read through my thought process.

First let’s start with Docker [buildx](https://docs.docker.com/buildx/working-with-buildx/) (the Github repository is located [here](https://github.com/docker/buildx)). I actually stumbled into `buildx` as I was searching for a way to do distributed caching for Docker builds. The issue I saw with many existing build servers was that caching by default was not a standard. I reasoned that this was due to the fact for any given Dockerfile, if you’ve built that Dockerfile before, you want to ensure it lands on the server to take advantage of the already built intermediate images, but perhaps there is overhead in ensuring that happens or there are limitations to the systems. I started to think ‘well why worry about ensuring you land on the same server if you could distribute the intermediate images to somewhere else?’ I googled [docker build distributed cache](https://www.google.com/search?q=docker+build+distributed+cache) and came across an article [Docker build cache sharing on multi-hosts with BuildKit and buildx](https://medium.com/titansoft-engineering/docker-build-cache-sharing-on-multi-hosts-with-buildkit-and-buildx-eb8f7005918e). I was familiar with [BuildKit](https://docs.docker.com/develop/develop-images/build_enhancements/) (the Github repository is located [here](https://github.com/moby/buildkit)) from DockerCon last year but I hadn’t heard of `buildx` before reading the article. A tl;dr of the article goes to show that using a distributed cache they are able to reduce the build time of their image on a fresh host from 6 minutes using standard `docker build` to 1 minute using `buildx` and its distributed caching. I knew I had found the tool I was looking for. 

As I started to learn more about `buildx` I came across its [bake](https://github.com/docker/buildx#buildx-bake-options-target) functionality which is described as “Bake is a high-level build command. Each specified target will run in parallel as part of the build.” In more layman terms, it can build all the images in a `docker-compose` file in parallel. This piqued my interest as I had been working on a project for work that was very heavily based on using `docker-compose`. I began putting the pieces of the puzzle together in my head, there are parallel builds of all the images your project needs and everything is stored on a distributed cache by default, this sounds like a great solution to creating a performant and scalable build server.

Next I needed to decide how I was going to run the builds and if that wasn’t clear from the title and intro, I was going to use Elixir. I started researching how to run asynchronous jobs in Elixir and came across a post on [elixirforum](https://elixirforum.com/) asking [Replacing Rails Background Jobs with an Elixir Service](https://elixirforum.com/t/replacing-rails-background-jobs-with-an-elixir-service/13336/11). With my background primarily in Rails and quickly reaching for Sidekiq anytime I need to do background processing, seeing a [reply](https://elixirforum.com/t/replacing-rails-background-jobs-with-an-elixir-service/13336/8) to that post about [Faktory](http://contribsys.com/faktory/) which was created by Mike Perham, the creator of Sidekiq, I was immediately intrigued. 

Kubernetes




That concludes my thought process for putting this project together and as I decided to write this blog post I wanted to extract the minimal amount of code needed to provide a working demo. My main project expands on the demo by listening to Github for webhooks, having Postgres for storing information about the builds, and a setup for allowing an on prem type solution where someone could deploy something similar to the demo in their own cluster. With that said, the following code will set up a Pheonix application that connects to Kubernetes, creates buildx nodes, connects to Faktory, and allows for spawning jobs that will create builds. If you look at the project on Github, I’ve incl

mix phx.new elixir_buildx_kubernetes --no-webpack --no-ecto --no-html

Add faktory_worker to mix.exs
{:faktory_worker, "~> 1.2.0"},

Configure the worker in application.ex

{% highlight ruby %}
{FaktoryWorker,
  [
    connection: [
      host: System.get_env("FAKTORY_HOST", "localhost")
    ],
    worker_pool: [
      size: 5,
      queues: ["builds"]
    ]
  ]
}
{% endhighlight %}

Build repository_fetcher.ex

Dockerfile (https://dev.to/ilsanto/deploy-a-phoenix-app-with-docker-stack-1j9c, https://akoutmos.com/post/multipart-docker-and-elixir-1.9-releases/)





