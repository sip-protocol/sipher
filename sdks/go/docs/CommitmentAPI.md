# \CommitmentAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CommitmentAdd**](CommitmentAPI.md#CommitmentAdd) | **Post** /v1/commitment/add | Add two commitments (homomorphic)
[**CommitmentCreate**](CommitmentAPI.md#CommitmentCreate) | **Post** /v1/commitment/create | Create Pedersen commitment
[**CommitmentCreateBatch**](CommitmentAPI.md#CommitmentCreateBatch) | **Post** /v1/commitment/create/batch | Batch create Pedersen commitments
[**CommitmentSubtract**](CommitmentAPI.md#CommitmentSubtract) | **Post** /v1/commitment/subtract | Subtract two commitments (homomorphic)
[**CommitmentVerify**](CommitmentAPI.md#CommitmentVerify) | **Post** /v1/commitment/verify | Verify Pedersen commitment



## CommitmentAdd

> CommitmentAdd200Response CommitmentAdd(ctx).CommitmentAddRequest(commitmentAddRequest).Execute()

Add two commitments (homomorphic)

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
	commitmentAddRequest := *openapiclient.NewCommitmentAddRequest("CommitmentA_example", "CommitmentB_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // CommitmentAddRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CommitmentAPI.CommitmentAdd(context.Background()).CommitmentAddRequest(commitmentAddRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CommitmentAPI.CommitmentAdd``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommitmentAdd`: CommitmentAdd200Response
	fmt.Fprintf(os.Stdout, "Response from `CommitmentAPI.CommitmentAdd`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommitmentAddRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commitmentAddRequest** | [**CommitmentAddRequest**](CommitmentAddRequest.md) |  | 

### Return type

[**CommitmentAdd200Response**](CommitmentAdd200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CommitmentCreate

> CommitmentCreate200Response CommitmentCreate(ctx).CommitmentCreateRequest(commitmentCreateRequest).Execute()

Create Pedersen commitment

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
	commitmentCreateRequest := *openapiclient.NewCommitmentCreateRequest("Value_example") // CommitmentCreateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CommitmentAPI.CommitmentCreate(context.Background()).CommitmentCreateRequest(commitmentCreateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CommitmentAPI.CommitmentCreate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommitmentCreate`: CommitmentCreate200Response
	fmt.Fprintf(os.Stdout, "Response from `CommitmentAPI.CommitmentCreate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommitmentCreateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commitmentCreateRequest** | [**CommitmentCreateRequest**](CommitmentCreateRequest.md) |  | 

### Return type

[**CommitmentCreate200Response**](CommitmentCreate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CommitmentCreateBatch

> CommitmentCreateBatch200Response CommitmentCreateBatch(ctx).CommitmentCreateBatchRequest(commitmentCreateBatchRequest).Execute()

Batch create Pedersen commitments



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
	commitmentCreateBatchRequest := *openapiclient.NewCommitmentCreateBatchRequest([]openapiclient.CommitmentCreateBatchRequestItemsInner{*openapiclient.NewCommitmentCreateBatchRequestItemsInner("Value_example")}) // CommitmentCreateBatchRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CommitmentAPI.CommitmentCreateBatch(context.Background()).CommitmentCreateBatchRequest(commitmentCreateBatchRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CommitmentAPI.CommitmentCreateBatch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommitmentCreateBatch`: CommitmentCreateBatch200Response
	fmt.Fprintf(os.Stdout, "Response from `CommitmentAPI.CommitmentCreateBatch`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommitmentCreateBatchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commitmentCreateBatchRequest** | [**CommitmentCreateBatchRequest**](CommitmentCreateBatchRequest.md) |  | 

### Return type

[**CommitmentCreateBatch200Response**](CommitmentCreateBatch200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CommitmentSubtract

> CommitmentAdd200Response CommitmentSubtract(ctx).CommitmentAddRequest(commitmentAddRequest).Execute()

Subtract two commitments (homomorphic)

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
	commitmentAddRequest := *openapiclient.NewCommitmentAddRequest("CommitmentA_example", "CommitmentB_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // CommitmentAddRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CommitmentAPI.CommitmentSubtract(context.Background()).CommitmentAddRequest(commitmentAddRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CommitmentAPI.CommitmentSubtract``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommitmentSubtract`: CommitmentAdd200Response
	fmt.Fprintf(os.Stdout, "Response from `CommitmentAPI.CommitmentSubtract`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommitmentSubtractRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commitmentAddRequest** | [**CommitmentAddRequest**](CommitmentAddRequest.md) |  | 

### Return type

[**CommitmentAdd200Response**](CommitmentAdd200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CommitmentVerify

> CommitmentVerify200Response CommitmentVerify(ctx).CommitmentVerifyRequest(commitmentVerifyRequest).Execute()

Verify Pedersen commitment

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
	commitmentVerifyRequest := *openapiclient.NewCommitmentVerifyRequest("Commitment_example", "Value_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // CommitmentVerifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CommitmentAPI.CommitmentVerify(context.Background()).CommitmentVerifyRequest(commitmentVerifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CommitmentAPI.CommitmentVerify``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CommitmentVerify`: CommitmentVerify200Response
	fmt.Fprintf(os.Stdout, "Response from `CommitmentAPI.CommitmentVerify`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCommitmentVerifyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commitmentVerifyRequest** | [**CommitmentVerifyRequest**](CommitmentVerifyRequest.md) |  | 

### Return type

[**CommitmentVerify200Response**](CommitmentVerify200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

