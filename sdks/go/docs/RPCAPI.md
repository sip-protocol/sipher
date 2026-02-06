# \RPCAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetRpcProviders**](RPCAPI.md#GetRpcProviders) | **Get** /v1/rpc/providers | List supported RPC providers and active configuration



## GetRpcProviders

> GetRpcProviders200Response GetRpcProviders(ctx).Execute()

List supported RPC providers and active configuration

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RPCAPI.GetRpcProviders(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RPCAPI.GetRpcProviders``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRpcProviders`: GetRpcProviders200Response
	fmt.Fprintf(os.Stdout, "Response from `RPCAPI.GetRpcProviders`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetRpcProvidersRequest struct via the builder pattern


### Return type

[**GetRpcProviders200Response**](GetRpcProviders200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

