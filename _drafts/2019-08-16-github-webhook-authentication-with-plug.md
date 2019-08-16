---
published: false
---
My first post about Elixir, Yay!

Recently I was able to come up with a project of the correct size to be able to start building a side project in Elixir and stick with it. In the past I would either build something like a simple TODO App and not get far enough into the language or I would decide to tackle some gigantic idea and get nowhere due to how daunting it was. However, one of my co-workers recently implemented a cool feature in Slack where we are required to add a label to our Pull Requests and in doing so it notifies the channel that is the PR is ready to reviewed through the [Github Webhooks API](https://developer.github.com/webhooks/). I decided that I wanted to rebuild it in Elixir and in doing so, be able to write about what I learn along the way; this is the first in what I hope to be many posts about my journey. With that said, if you're unfamiliar with the webhooks API or how to set it up on your repository, please read the link above because we're jumping right in!

We're going to create a [Plug]() that will read the secret from the webhooks API and halt the connection if the request does not authenticate. We'll start off with a basic outline of what we want to do.

```ruby
defmodule MyApp.Plugs.GithubAuthentication do
  import Plug.Conn

  def init(_params) do
  end

  def call(conn, _params) do
    with {:ok, digest} <- get_signature_digest(conn),
         {:ok, secret} <- get_secret(),
         {:ok} <- valid_request?(digest, secret, conn)
    do
      conn
    else
      _ -> conn |> halt()
    end
  end

  defp get_signature_digest(conn) do
  end

  defp get_secret do
  end

  defp valid_request?(digest, secret, conn) do
  end
end
```

The first thing I want to note is that I never understood [with]() until now. When it was introduced the syntax just totally threw me off and since I wasn't writing much Elixir at the time it never clicked. However, I'm totally happy I understand it now because it is the perfect construct for what we want to do.

First, we want to get the signature of the request that Github has sent. If we look at the [Payloads](https://developer.github.com/webhooks/#payloads) section of the API docs we'll see that Github adds a `X-Hub-Signature` header to each request. It is described as
```
The HMAC hex digest of the response body. This header will be sent if the webhook is configured with a secret. The HMAC hex digest is generated using the sha1 hash function and the secret as the HMAC key.
```
which we will come back to a little later when we need to build the digest ourselves, but for now lets fill in `get_signature_digest` to grab the header from the request. Plug has a function to help us do this [get_req_header/2](https://hexdocs.pm/plug/Plug.Conn.html#get_req_header/2) so let's use that.

```ruby
  defp get_signature_digest(conn) do
    case get_req_header(conn, "x-hub-signature") do
      ["sha1=" <> digest] -> {:ok, digest}
      _ -> {:error, "No Github Signature Found"}
    end
  end
```

If you look at the [Example Delivery](https://developer.github.com/webhooks/#example-delivery) from Github, it shows
```
X-Hub-Signature: sha1=7d38cdd689735b008b3c702edd92eea23791c5f6
```
so what we want to do is pattern match on the header value to ensure it is formed correctly with `sha1=` precreeding the digest and then return the digest.

Next we need to know the secret that was used to create the digest, which is easy, because we get to define it! I decided to store it as an environment variable and retrieve it through [Application.get_env](https://hexdocs.pm/elixir/Application.html#get_env/3), but you could do this any way you choose.

```ruby
defp get_secret
  Application.get_env(:my_app, :github_secret)
end
```



