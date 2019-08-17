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

The first thing I want to note is that I never understood [with]() until now. When it was introduced the syntax just totally threw me off and since I wasn't writing much Elixir at the time, it never clicked. However, I'm totally happy I understand it now because it is the perfect construct for what we want to do.

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

Next we need to know the secret that was used to create the digest. For this example I'm going to use [Application.get_env](https://hexdocs.pm/elixir/Application.html#get_env/3).

```ruby
defp get_secret
  Application.get_env(:my_app, :github_secret)
end
```

However, this is a very basic usecase that will work if we only have one a single key to handle, but what if we were building an application that handled requests from many repositories? That is what the project I'm working on will do so I need to be able to find the secrets in the database. While I'm not going to cover that implemenation here, what it means is that I need to have the parsed request body available at the time `get_secret` is called; likely I would have a `get_secret/1` which took in the repository url to be able to find its secret. For now lets continue on, but we'll see why needing access to the parsed and raw response bodies matter.

Now that we have both the digest and the secret in hand, we need to rebuild the digest from the request to see if we have a match. If you recall the description of the `X-Hub-Signature` starts off with `The HMAC hex digest of the response body` so what we need is access not to the parsed response body, but to the raw response body. Thankfully this exact type of functionality was added to Plug in the form of a [Custom body reader](https://hexdocs.pm/plug/Plug.Parsers.html#module-custom-body-reader); we just need to copy the docs into our application!

```ruby
defmodule MyApp.Plugs.CacheBodyReader do
  def read_body(conn, opts) do
    {:ok, body, conn} = Plug.Conn.read_body(conn, opts)
    conn = update_in(conn.assigns[:raw_body], &[body | (&1 || [])])
    {:ok, body, conn}
  end
end
```

We'll come back to where to put this code when we wrap up, but for now we know that `conn.assigns.raw_body` exists so let's put it to use in `valid_request?`.

```ruby
defp valid_request?(digest, secret, conn) do
  hmac = :crypto.hmac(:sha, secret, conn.assigns.raw_body) |> Base.encode16(case: :lower)
  if Plug.Crypto.secure_compare(digest, hmac), do: {:ok}, else: {:error}
end
```

We generate the hmac using Erlang's [crypto](http://erlang.org/doc/man/crypto.html#hmac-3) library and then encode it to lowercase to ensure it matches the form of Github's signature. At the very bottom of Github's [Securing your webhooks](https://developer.github.com/webhooks/securing/) they note
```
Using a plain == operator is not advised. A method like secure_compare performs a "constant time" string comparison, which renders it safe from certain timing attacks against regular equality operators.
```
so to compare the two digests, we'll use [Plug.Crypto.secure_compare](https://hexdocs.pm/plug/Plug.Crypto.html#secure_compare/2). The entire Plug now looks like this.

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
      _ -> conn |> send_resp(401, "Couldn't Authenticate") |> halt()
    end
  end

  defp get_signature_digest(conn) do
    case get_req_header(conn, "x-hub-signature") do
      ["sha1=" <> digest] -> {:ok, digest}
      _ -> {:error, "No Github Signature Found"}
    end
  end

  defp get_secret
    Application.get_env(:my_app, :github_secret)
  end

  defp valid_request?(digest, secret, conn) do
    hmac = :crypto.hmac(:sha, secret, conn.assigns.raw_body) |> Base.encode16(case: :lower)
    if Plug.Crypto.secure_compare(digest, hmac), do: {:ok}, else: {:error}
  end
end
```

Now we can create a [Router](https://hexdocs.pm/plug/Plug.Router.html) and test out our implementation.

```ruby
defmodule MyApp.Router do
  use Plug.Router

  plug(Plug.Logger)
  plug(Plug.Parsers,
    parsers: [:json],
    body_reader: {MyApp.Plugs.CacheBodyReader, :read_body, []},
    json_decoder: Jason)
  plug(MyApp.Plugs.GithubAuthentication)
  plug(:match)
  plug(:dispatch)

  post "events" do
    send_resp(conn, 200, "Sucessful Event!")
  end
end
```

The ordering of the Plugs becomes important because if you recall, I want the parsed body available when we do the authentication so we need to put the `Parsers` Plug above the `GithubAuthentication`. We need to add the `body_reader: {MyApp.Plugs.CacheBodyReader, :read_body, []},` line to ensure that the raw body is also available when we're trying to authenticate. Finally we'll add an endpoint to test the events and we should be good to go.

Let's try it out. I'm going to use [ngrok](https://ngrok.com) to expose a url Github can reach and then send over an event.

```
Session Status                online        
Session Expires               7 hours, 40 minutes                    
Version                       2.3.34         
Region                        United States (us)      
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://9f3e1658.ngrok.io -> http://localhost:4001
Forwarding                    https://9f3e1658.ngrok.io -> http://localhost:4001       
Connections                   ttl     opn     rt1     rt5     p50     p90
                              2       0       0.00    0.00    0.19    0.23                                            
HTTP Requests                                           
-------------
POST /events                  401 Unauthorized    
POST /events                  200 OK  
```