# nwp (unstable)

nwp is a nodejs based wrapper for wp-cli.phar that allows structuring multiple wp-cli commands in a JSON format.

# Dependencies

wp-cli must be installed and accessible to the same user that is running nwp.

# Example

recipe.json
```
{
  "post": {
    "create": {
      "$first_post": { 
      "args": { "file": "dummypost.txt" },  
      "opts": {  
        "post_title": "cart",
        "post_name": "cart",
        "post_type":"page",
        "post_status": "publish" }
      }
    }
  }
}
```

Will run this command:

```wp post create "dummypost.txt" --post_title="cart" --post_name="cart" --post_type="page" --post_status="publish" --quiet --porcelain```

And store the ID of the created post in the environment as "$first_post" which can be used on subsequent commands.
.

# Usage

