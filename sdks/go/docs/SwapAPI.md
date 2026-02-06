# \SwapAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**PrivateSwap**](SwapAPI.md#PrivateSwap) | **Post** /v1/swap/private | Privacy-preserving token swap via Jupiter DEX



## PrivateSwap

> PrivateSwap200Response PrivateSwap(ctx).PrivateSwapRequest(privateSwapRequest).Execute()

Privacy-preserving token swap via Jupiter DEX



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	privateSwapRequest := *openapiclient.NewPrivateSwapRequest("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "1000000000", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at") // PrivateSwapRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SwapAPI.PrivateSwap(context.Background()).PrivateSwapRequest(privateSwapRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SwapAPI.PrivateSwap``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PrivateSwap`: PrivateSwap200Response
	fmt.Fprintf(os.Stdout, "Response from `SwapAPI.PrivateSwap`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPrivateSwapRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **privateSwapRequest** | [**PrivateSwapRequest**](PrivateSwapRequest.md) |  | 

### Return type

[**PrivateSwap200Response**](PrivateSwap200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

