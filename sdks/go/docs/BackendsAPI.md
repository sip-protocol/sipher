# \BackendsAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**BackendsCompare**](BackendsAPI.md#BackendsCompare) | **Post** /v1/backends/compare | Compare privacy backends
[**BackendsHealth**](BackendsAPI.md#BackendsHealth) | **Get** /v1/backends/{id}/health | Check backend health
[**BackendsList**](BackendsAPI.md#BackendsList) | **Get** /v1/backends | List privacy backends
[**BackendsSelect**](BackendsAPI.md#BackendsSelect) | **Post** /v1/backends/select | Select preferred backend



## BackendsCompare

> BackendsCompare200Response BackendsCompare(ctx).BackendsCompareRequest(backendsCompareRequest).Execute()

Compare privacy backends



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
	backendsCompareRequest := *openapiclient.NewBackendsCompareRequest("Operation_example") // BackendsCompareRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BackendsAPI.BackendsCompare(context.Background()).BackendsCompareRequest(backendsCompareRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BackendsAPI.BackendsCompare``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackendsCompare`: BackendsCompare200Response
	fmt.Fprintf(os.Stdout, "Response from `BackendsAPI.BackendsCompare`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBackendsCompareRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **backendsCompareRequest** | [**BackendsCompareRequest**](BackendsCompareRequest.md) |  | 

### Return type

[**BackendsCompare200Response**](BackendsCompare200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## BackendsHealth

> BackendsHealth200Response BackendsHealth(ctx, id).Execute()

Check backend health



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
	id := "id_example" // string | Backend name (e.g., sip-native)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BackendsAPI.BackendsHealth(context.Background(), id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BackendsAPI.BackendsHealth``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackendsHealth`: BackendsHealth200Response
	fmt.Fprintf(os.Stdout, "Response from `BackendsAPI.BackendsHealth`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Backend name (e.g., sip-native) | 

### Other Parameters

Other parameters are passed through a pointer to a apiBackendsHealthRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

[**BackendsHealth200Response**](BackendsHealth200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## BackendsList

> BackendsList200Response BackendsList(ctx).Execute()

List privacy backends



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
	resp, r, err := apiClient.BackendsAPI.BackendsList(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BackendsAPI.BackendsList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackendsList`: BackendsList200Response
	fmt.Fprintf(os.Stdout, "Response from `BackendsAPI.BackendsList`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiBackendsListRequest struct via the builder pattern


### Return type

[**BackendsList200Response**](BackendsList200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## BackendsSelect

> BackendsSelect200Response BackendsSelect(ctx).BackendsSelectRequest(backendsSelectRequest).Execute()

Select preferred backend



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
	backendsSelectRequest := *openapiclient.NewBackendsSelectRequest("sip-native") // BackendsSelectRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.BackendsAPI.BackendsSelect(context.Background()).BackendsSelectRequest(backendsSelectRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `BackendsAPI.BackendsSelect``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `BackendsSelect`: BackendsSelect200Response
	fmt.Fprintf(os.Stdout, "Response from `BackendsAPI.BackendsSelect`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiBackendsSelectRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **backendsSelectRequest** | [**BackendsSelectRequest**](BackendsSelectRequest.md) |  | 

### Return type

[**BackendsSelect200Response**](BackendsSelect200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

