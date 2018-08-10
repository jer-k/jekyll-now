---
published: false
---
An update to my post on [adding a testing environment to a gem](https://jer-k.github.io/testing-and-developer-scripts-for-active-record-gem/). After doing some recent updates our Docker images for projects at work, I realized that we were always using Ruby Alpine images, instead of the base Ruby image. I'm not entirely sure why I built the gem's Dockerfile using the base Ruby image, but I wanted to standardize and decided to look into what it would take to do.

But first, why choose an Alpine image? Well many other developers have covered it in their blog posts and I think it is best not wander down that path again. Instead I'll 