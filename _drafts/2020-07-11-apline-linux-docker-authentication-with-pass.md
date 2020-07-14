---
published: false
---
![insecure docker login](https://raw.githubusercontent.com/jer-k/jer-k.github.io/master/_posts/post_images/insecure_docker_login.png)

If you've ever encountered the above message when logging into Docker and thought to yourself "Well its unecrypted but it works so I'll deal with it another day" then we've got something in common. That day finally came when I was working on another blog post but realized that without a secure way to do a `docker login` I was never going to achieve a good working example to write about. Thus I veered off onto the path of figuring out what is needed to automate securely logging into Docker without any user input. I came across [docker-credential-helpers](https://github.com/docker/docker-credential-helpers) which looked like exactly what I needed. One of the recommended ways to store the encrypted passwords is with [pass](https://www.passwordstore.org/). However, once I started looking at pass, I wasn't really sure where to start on getting everything working. Apparently I was not alone because after some googling I came across an issue on the docker-credential-helpers Github [Document how to initialize docker-credentials-pass](https://github.com/docker/docker-credential-helpers/issues/102). After reading through all of the discussion I felt like I understood enough to set out and figure out once and for all how to get rid of the pesky Docker warning.

If you prefer, you can view the [Dockerfile](https://github.com/jer-k/alpine_docker_pass/blob/master/Dockerfile) on Github, otherwise continue reading and I'll show the entire file, then break down each piece.

```dockerfile
# syntax = docker/dockerfile:experimental
FROM alpine

ENV USER=docker_user
ENV HOME=/home/$USER

RUN addgroup -S appgroup && adduser -u 1001 -S $USER -G appgroup

RUN apk --update upgrade && apk add --update  docker \
                                              gnupg \
                                              pass

# As of 7/10/2020 the latest release of docker-credential-helpers is 0.6.3
RUN wget https://github.com/docker/docker-credential-helpers/releases/download/v0.6.3/docker-credential-pass-v0.6.3-amd64.tar.gz \
    && tar -xf docker-credential-pass-v0.6.3-amd64.tar.gz \
    && chmod +x docker-credential-pass \ 
    && mv docker-credential-pass /usr/local/bin/ \
    && rm docker-credential-pass-v0.6.3-amd64.tar.gz

# Create the .docker directory, copy in the config.json file which sets the credential store as pass, and set the correct permissions
RUN mkdir -p $HOME/.docker/
COPY config.json $HOME/.docker/
RUN chown -R $USER:appgroup $HOME/.docker
RUN chmod -R 755 $HOME/.docker

# Create the .gnupg directory and set the correct permissions
RUN mkdir -p $HOME/.gnupg/
RUN chown -R $USER:appgroup $HOME/.gnupg
RUN chmod -R 700 $HOME/.gnupg

WORKDIR $HOME
USER $USER

COPY gpg_file.txt .

# Edit the gpg file to add our password and generate the key
RUN --mount=type=secret,id=gpg_password,uid=1001 cat gpg_file.txt | sed 's/gpg_password/'"`cat /run/secrets/gpg_password`"'/g' | gpg --batch --generate-key

# Generate the pass store by accessing and passing the gpg fingerprint
RUN pass init $(gpg --list-secret-keys dockertester@docker.com | sed -n '/sec/{n;p}' | sed 's/^[ \t]*//;s/[ \t]*$//')

# Login to Docker
ARG DOCKER_USER
RUN --mount=type=secret,id=docker_password,uid=1001 cat /run/secrets/docker_password | docker login --username $DOCKER_USER --password-stdin

# Using cat will keep the container running
CMD ["cat"]
```

Alright that was the Dockerfile in its entirety so let's jump into explaining what is going on. 

```dockerfile
# syntax = docker/dockerfile:experimental
FROM alpine

ENV USER=docker_user
ENV HOME=/home/$USER

RUN addgroup -S appgroup && adduser -u 1001 -S $USER -G appgroup

RUN apk --update upgrade && apk add --update  docker \
                                              gnupg \
                                              pass
```

First off, I'm using features from Docker's [BuildKit](https://github.com/moby/buildkit) and the first line `# syntax = docker/dockerfile:experimental` enables some new features. If you haven't read about the experimental features, you can do [here](https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/experimental.md). I'm going to use [Alpine Linux](https://alpinelinux.org/) as my base image, as it has been my go to for building Docker images for quite some time now. I've added a user and set up a new home directory so that we can run the docker image as a non-root user. The last piece here is adding the packages we'll need: `docker` because thats what we're trying log into, `gnupg` to generate a certificate for seeding pass, and `pass` to securely store our credentials.

```dockerfile
# As of 7/10/2020 the latest release of docker-credential-helpers is 0.6.3
RUN wget https://github.com/docker/docker-credential-helpers/releases/download/v0.6.3/docker-credential-pass-v0.6.3-amd64.tar.gz \
    && tar -xf docker-credential-pass-v0.6.3-amd64.tar.gz \
    && chmod +x docker-credential-pass \ 
    && mv docker-credential-pass /usr/local/bin/ \
    && rm docker-credential-pass-v0.6.3-amd64.tar.gz
```

Next we'll install `docker-credential-helpers` and one of the first comments on the aforementioned issue [showed](https://github.com/docker/docker-credential-helpers/issues/102#issuecomment-388974092) how to do this. I just modified the release number to get the most up to date version.

```
# Create the .docker directory, copy in the config.json file which sets the credential store as pass, and set the correct permissions
RUN mkdir -p $HOME/.docker/
COPY config.json $HOME/.docker/
RUN chown -R $USER:appgroup $HOME/.docker
RUN chmod -R 755 $HOME/.docker
```

```
# config.json file

{
  "credsStore": "pass"
}
```

Now we need to create our `.docker` directory and ensure that our user has full control over it. We copy in the `config.json` file which tells Docker to use `pass` as a credential store.


```
# Create the .gnupg directory and set the correct permissions
RUN mkdir -p $HOME/.gnupg/
RUN chown -R $USER:appgroup $HOME/.gnupg
RUN chmod -R 700 $HOME/.gnupg
```

After a little bit of trail and error, I discovered that I needed a `.gnupg` directory with correct permissions before `gpg` would allow me to generate the key. With that, everything is now setup to start generating our secure login.

```
WORKDIR $HOME
USER $USER

COPY gpg_file.txt .

# Edit the gpg file to add our password and generate the key
RUN --mount=type=secret,id=gpg_password,uid=1001 cat gpg_file.txt | sed 's/gpg_password/'"`cat /run/secrets/gpg_password`"'/g' | gpg --batch --generate-key
```

```
# gpg_file.txt 

# Example from https://www.gnupg.org/documentation//manuals/gnupg/Unattended-GPG-key-generation.html
%echo Generating a basic OpenPGP key
Key-Type: DSA
Key-Length: 1024
Subkey-Type: ELG-E
Subkey-Length: 1024
Name-Real: Docker Tester
Name-Comment: with stupid passphrase
Name-Email: dockertester@docker.com
Expire-Date: 0
Passphrase: gpg_password
# Do a commit here, so that we can later print "done" :-)
%commit
%echo done
```

Okay there is a bit to unpack here, but first we set our `WORKDIR` to the `$HOME` directory and change from the root user to our `$USER`. Next we copy in the `gpg_file.txt` file shown above, which is a modified example from [gnupg.org](https://www.gnupg.org/documentation//manuals/gnupg/Unattended-GPG-key-generation.html). The `RUN` line can be broken down into a few different pieces so we'll go through it piece by piece.

`--mount=type=secret,id=gpg_password,uid=1001` is taking advantage of using [BuildKit secrets](https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/experimental.md#run---mounttypesecret). If you want to read about BuildKit secrets, I would suggest the official Docker documentation [New Docker Build secret information](https://docs.docker.com/develop/develop-images/build_enhancements/#new-docker-build-secret-information), however the gist of this functionality is that the secret is only supplied to this single `RUN` command and is not left behind as an artifact in the layer. The command is saying to make available the mounted secret at `id=gpg_password` and access it as user 1001 (which we set when we generated the user).  

As a side note, I would have used say `$USER_UID` but this mount command cannot interpret a Docker environment variable (see BuildKit issue [815](https://github.com/moby/buildkit/issues/815)) so I had to hardcode the id.

`cat gpg_file.txt | sed 's/gpg_password/'"&96cat /run/secrets/gpg_password&96"'/g' |` is piping the contents of our `gpg_file.txt` file into `sed` where we're doing a find on `gpg_password` and replacing it by accessing our mounted secret at and ouputting the value through `cat`.

`gpg --batch --generate-key` is receving the contents of the file, with our password in place and generating the key in unattended mode via the `--batch` flag. With that we've successfully generated a key we can use to seed `pass`.

```
# Generate the pass store by accessing and passing the gpg fingerprint
RUN pass init $(gpg --list-secret-keys dockertester@docker.com | sed -n '/sec/{n;p}' | sed 's/^[ \t]*//;s/[ \t]*$//')
```

```
# Login to Docker
ARG DOCKER_USER
RUN --mount=type=secret,id=docker_password,uid=1001 cat /run/secrets/docker_password | docker login --username $DOCKER_USER --password-stdin
```

The final piece is just running `cat` with `busybox`

```
# Using cat with busybox will keep the container running
CMD ["cat"]
```



To build the image we need to instruct Docker that we're using BuildKit and supply the secrets we referenced in the `Dockerfile`. Don't forget to replace `your_docker_username` with your actual Docker username!

```
$ DOCKER_BUILDKIT=1 docker build -t alpine_docker_pass --secret id=gpg_password,src=gpg_password.txt --secret id=docker_password,src=docker_password.txt --build-arg DOCKER_USER=your_docker_username .
```

That wraps up everything you need to need to know

```
bash-5.0$ docker login
Authenticating with existing credentials...
Login Succeeded
```
