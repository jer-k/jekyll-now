---
published: false
---
![insecure docker login](https://raw.githubusercontent.com/jer-k/jer-k.github.io/master/_posts/post_images/insecure_docker_login.png)

If you've ever encountered the above message when logging into Docker and thought to yourself "Well its unecrypted but it works so I'll deal with it another day" then we've got something in common. That other day finally came when I was working on another blog post but realized that without a secure way to do a `docker login` I was never going to achieve a good working example to write about. Thus I veered off onto the path of figuring out what is needed to automate securely logging into Docker without any user input.

If you want to see the final Dockerfile, you can view it [here](https://github.com/jer-k/alpine_docker_pass/blob/master/Dockerfile)

```dockerfile
# syntax = docker/dockerfile:experimental
FROM alpine

ENV USER=docker_user
ENV HOME=/home/$USER

RUN addgroup -S appgroup && adduser -u 1001 -S $USER -G appgroup

RUN apk --update upgrade && apk add --update  docker \
                                              gnupg \
                                              pass \
                                              busybox
```

```dockerfile
# As of 7/10/2020 the latest release of docker-credential-helpers is 0.6.3
RUN wget https://github.com/docker/docker-credential-helpers/releases/download/v0.6.3/docker-credential-pass-v0.6.3-amd64.tar.gz \
    && tar -xf docker-credential-pass-v0.6.3-amd64.tar.gz \
    && chmod +x docker-credential-pass \ 
    && mv docker-credential-pass /usr/local/bin/ \
    && rm docker-credential-pass-v0.6.3-amd64.tar.gz
```

```
# Create the .docker directory, copy in the config.json file which sets the credential store as pass, and set the correct permissions
RUN mkdir -p $HOME/.docker/
COPY config.json $HOME/.docker/
RUN chown -R $USER:appgroup $HOME/.docker
RUN chmod -R 755 $HOME/.docker
```

```
# Create the .gnupg directory and set the correct permissions
RUN mkdir -p $HOME/.gnupg/
RUN chown -R $USER:appgroup $HOME/.gnupg
RUN chmod -R 700 $HOME/.gnupg
```

```
WORKDIR $HOME

COPY gpg_file.txt .

USER $USER

# Edit the gpg file to add our password and generate the key
RUN --mount=type=secret,id=gpg_password,uid=1001 cat gpg_file.txt | sed 's/gpg_password/'"`cat /run/secrets/gpg_password`"'/g' | gpg --batch --generate-key
```


```
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