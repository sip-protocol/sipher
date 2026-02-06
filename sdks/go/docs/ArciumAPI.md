# \ArciumAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DecryptArciumResult**](ArciumAPI.md#DecryptArciumResult) | **Post** /v1/arcium/decrypt | Decrypt computation result
[**GetArciumComputationStatus**](ArciumAPI.md#GetArciumComputationStatus) | **Get** /v1/arcium/compute/{id}/status | Get computation status
[**SubmitArciumComputation**](ArciumAPI.md#SubmitArciumComputation) | **Post** /v1/arcium/compute | Submit MPC computation



## DecryptArciumResult

> DecryptArciumResult200Response DecryptArciumResult(ctx).DecryptArciumResultRequest(decryptArciumResultRequest).Execute()

Decrypt computation result



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
	decryptArciumResultRequest := *openapiclient.NewDecryptArciumResultRequest("ComputationId_example", *openapiclient.NewDecryptArciumResultRequestViewingKey("Key_example", "Path_example", "Hash_example")) // DecryptArciumResultRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ArciumAPI.DecryptArciumResult(context.Background()).DecryptArciumResultRequest(decryptArciumResultRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ArciumAPI.DecryptArciumResult``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DecryptArciumResult`: DecryptArciumResult200Response
	fmt.Fprintf(os.Stdout, "Response from `ArciumAPI.DecryptArciumResult`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDecryptArciumResultRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **decryptArciumResultRequest** | [**DecryptArciumResultRequest**](DecryptArciumResultRequest.md) |  | 

### Return type

[**DecryptArciumResult200Response**](DecryptArciumResult200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetArciumComputationStatus

> GetArciumComputationStatus200Response GetArciumComputationStatus(ctx, id).Execute()

Get computation status



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
	id := "id_example" // string | Computation ID

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ArciumAPI.GetArciumComputationStatus(context.Background(), id).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ArciumAPI.GetArciumComputationStatus``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetArciumComputationStatus`: GetArciumComputationStatus200Response
	fmt.Fprintf(os.Stdout, "Response from `ArciumAPI.GetArciumComputationStatus`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** | Computation ID | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetArciumComputationStatusRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

[**GetArciumComputationStatus200Response**](GetArciumComputationStatus200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SubmitArciumComputation

> SubmitArciumComputation200Response SubmitArciumComputation(ctx).SubmitArciumComputationRequest(submitArciumComputationRequest).Execute()

Submit MPC computation



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
	submitArciumComputationRequest := *openapiclient.NewSubmitArciumComputationRequest("CircuitId_example", []string{"EncryptedInputs_example"}) // SubmitArciumComputationRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ArciumAPI.SubmitArciumComputation(context.Background()).SubmitArciumComputationRequest(submitArciumComputationRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ArciumAPI.SubmitArciumComputation``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitArciumComputation`: SubmitArciumComputation200Response
	fmt.Fprintf(os.Stdout, "Response from `ArciumAPI.SubmitArciumComputation`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitArciumComputationRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **submitArciumComputationRequest** | [**SubmitArciumComputationRequest**](SubmitArciumComputationRequest.md) |  | 

### Return type

[**SubmitArciumComputation200Response**](SubmitArciumComputation200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

