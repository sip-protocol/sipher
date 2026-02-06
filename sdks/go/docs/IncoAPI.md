# \IncoAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ComputeIncoCiphertexts**](IncoAPI.md#ComputeIncoCiphertexts) | **Post** /v1/inco/compute | Compute on encrypted data
[**DecryptIncoResult**](IncoAPI.md#DecryptIncoResult) | **Post** /v1/inco/decrypt | Decrypt FHE computation result
[**EncryptIncoValue**](IncoAPI.md#EncryptIncoValue) | **Post** /v1/inco/encrypt | Encrypt value with FHE



## ComputeIncoCiphertexts

> ComputeIncoCiphertexts200Response ComputeIncoCiphertexts(ctx).ComputeIncoCiphertextsRequest(computeIncoCiphertextsRequest).Execute()

Compute on encrypted data



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
	computeIncoCiphertextsRequest := *openapiclient.NewComputeIncoCiphertextsRequest("Operation_example", []string{"Ciphertexts_example"}) // ComputeIncoCiphertextsRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.IncoAPI.ComputeIncoCiphertexts(context.Background()).ComputeIncoCiphertextsRequest(computeIncoCiphertextsRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `IncoAPI.ComputeIncoCiphertexts``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ComputeIncoCiphertexts`: ComputeIncoCiphertexts200Response
	fmt.Fprintf(os.Stdout, "Response from `IncoAPI.ComputeIncoCiphertexts`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiComputeIncoCiphertextsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **computeIncoCiphertextsRequest** | [**ComputeIncoCiphertextsRequest**](ComputeIncoCiphertextsRequest.md) |  | 

### Return type

[**ComputeIncoCiphertexts200Response**](ComputeIncoCiphertexts200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DecryptIncoResult

> DecryptIncoResult200Response DecryptIncoResult(ctx).DecryptIncoResultRequest(decryptIncoResultRequest).Execute()

Decrypt FHE computation result



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
	decryptIncoResultRequest := *openapiclient.NewDecryptIncoResultRequest("ComputationId_example") // DecryptIncoResultRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.IncoAPI.DecryptIncoResult(context.Background()).DecryptIncoResultRequest(decryptIncoResultRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `IncoAPI.DecryptIncoResult``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DecryptIncoResult`: DecryptIncoResult200Response
	fmt.Fprintf(os.Stdout, "Response from `IncoAPI.DecryptIncoResult`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDecryptIncoResultRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **decryptIncoResultRequest** | [**DecryptIncoResultRequest**](DecryptIncoResultRequest.md) |  | 

### Return type

[**DecryptIncoResult200Response**](DecryptIncoResult200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## EncryptIncoValue

> EncryptIncoValue200Response EncryptIncoValue(ctx).EncryptIncoValueRequest(encryptIncoValueRequest).Execute()

Encrypt value with FHE



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
	encryptIncoValueRequest := *openapiclient.NewEncryptIncoValueRequest(openapiclient.encryptIncoValue_request_plaintext{Float32: new(float32)}, "Scheme_example") // EncryptIncoValueRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.IncoAPI.EncryptIncoValue(context.Background()).EncryptIncoValueRequest(encryptIncoValueRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `IncoAPI.EncryptIncoValue``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `EncryptIncoValue`: EncryptIncoValue200Response
	fmt.Fprintf(os.Stdout, "Response from `IncoAPI.EncryptIncoValue`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiEncryptIncoValueRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **encryptIncoValueRequest** | [**EncryptIncoValueRequest**](EncryptIncoValueRequest.md) |  | 

### Return type

[**EncryptIncoValue200Response**](EncryptIncoValue200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

