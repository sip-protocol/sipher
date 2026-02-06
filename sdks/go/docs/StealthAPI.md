# \StealthAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**StealthCheck**](StealthAPI.md#StealthCheck) | **Post** /v1/stealth/check | Check stealth address ownership
[**StealthDerive**](StealthAPI.md#StealthDerive) | **Post** /v1/stealth/derive | Derive one-time stealth address
[**StealthGenerate**](StealthAPI.md#StealthGenerate) | **Post** /v1/stealth/generate | Generate stealth meta-address keypair
[**StealthGenerateBatch**](StealthAPI.md#StealthGenerateBatch) | **Post** /v1/stealth/generate/batch | Batch generate stealth keypairs



## StealthCheck

> StealthCheck200Response StealthCheck(ctx).StealthCheckRequest(stealthCheckRequest).Execute()

Check stealth address ownership

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
	stealthCheckRequest := *openapiclient.NewStealthCheckRequest(*openapiclient.NewStealthAddress("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", int32(123)), "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // StealthCheckRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StealthAPI.StealthCheck(context.Background()).StealthCheckRequest(stealthCheckRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StealthAPI.StealthCheck``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StealthCheck`: StealthCheck200Response
	fmt.Fprintf(os.Stdout, "Response from `StealthAPI.StealthCheck`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStealthCheckRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stealthCheckRequest** | [**StealthCheckRequest**](StealthCheckRequest.md) |  | 

### Return type

[**StealthCheck200Response**](StealthCheck200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## StealthDerive

> StealthDerive200Response StealthDerive(ctx).StealthDeriveRequest(stealthDeriveRequest).Execute()

Derive one-time stealth address

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
	stealthDeriveRequest := *openapiclient.NewStealthDeriveRequest(*openapiclient.NewStealthMetaAddress("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Chain_example")) // StealthDeriveRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StealthAPI.StealthDerive(context.Background()).StealthDeriveRequest(stealthDeriveRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StealthAPI.StealthDerive``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StealthDerive`: StealthDerive200Response
	fmt.Fprintf(os.Stdout, "Response from `StealthAPI.StealthDerive`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStealthDeriveRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stealthDeriveRequest** | [**StealthDeriveRequest**](StealthDeriveRequest.md) |  | 

### Return type

[**StealthDerive200Response**](StealthDerive200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## StealthGenerate

> StealthGenerate200Response StealthGenerate(ctx).StealthGenerateRequest(stealthGenerateRequest).Execute()

Generate stealth meta-address keypair

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
	stealthGenerateRequest := *openapiclient.NewStealthGenerateRequest() // StealthGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StealthAPI.StealthGenerate(context.Background()).StealthGenerateRequest(stealthGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StealthAPI.StealthGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StealthGenerate`: StealthGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `StealthAPI.StealthGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStealthGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stealthGenerateRequest** | [**StealthGenerateRequest**](StealthGenerateRequest.md) |  | 

### Return type

[**StealthGenerate200Response**](StealthGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## StealthGenerateBatch

> StealthGenerateBatch200Response StealthGenerateBatch(ctx).StealthGenerateBatchRequest(stealthGenerateBatchRequest).Execute()

Batch generate stealth keypairs



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
	stealthGenerateBatchRequest := *openapiclient.NewStealthGenerateBatchRequest(int32(123)) // StealthGenerateBatchRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StealthAPI.StealthGenerateBatch(context.Background()).StealthGenerateBatchRequest(stealthGenerateBatchRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StealthAPI.StealthGenerateBatch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StealthGenerateBatch`: StealthGenerateBatch200Response
	fmt.Fprintf(os.Stdout, "Response from `StealthAPI.StealthGenerateBatch`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStealthGenerateBatchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stealthGenerateBatchRequest** | [**StealthGenerateBatchRequest**](StealthGenerateBatchRequest.md) |  | 

### Return type

[**StealthGenerateBatch200Response**](StealthGenerateBatch200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

