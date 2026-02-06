# \ViewingKeyAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ViewingKeyDecrypt**](ViewingKeyAPI.md#ViewingKeyDecrypt) | **Post** /v1/viewing-key/decrypt | Decrypt transaction with viewing key
[**ViewingKeyDerive**](ViewingKeyAPI.md#ViewingKeyDerive) | **Post** /v1/viewing-key/derive | Derive child viewing key (BIP32-style)
[**ViewingKeyDisclose**](ViewingKeyAPI.md#ViewingKeyDisclose) | **Post** /v1/viewing-key/disclose | Encrypt transaction for disclosure
[**ViewingKeyGenerate**](ViewingKeyAPI.md#ViewingKeyGenerate) | **Post** /v1/viewing-key/generate | Generate viewing key
[**ViewingKeyVerifyHierarchy**](ViewingKeyAPI.md#ViewingKeyVerifyHierarchy) | **Post** /v1/viewing-key/verify-hierarchy | Verify viewing key parent-child relationship



## ViewingKeyDecrypt

> ViewingKeyDecrypt200Response ViewingKeyDecrypt(ctx).ViewingKeyDecryptRequest(viewingKeyDecryptRequest).Execute()

Decrypt transaction with viewing key

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
	viewingKeyDecryptRequest := *openapiclient.NewViewingKeyDecryptRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), *openapiclient.NewViewingKeyDecryptRequestEncrypted("Ciphertext_example", "Nonce_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")) // ViewingKeyDecryptRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ViewingKeyAPI.ViewingKeyDecrypt(context.Background()).ViewingKeyDecryptRequest(viewingKeyDecryptRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ViewingKeyAPI.ViewingKeyDecrypt``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ViewingKeyDecrypt`: ViewingKeyDecrypt200Response
	fmt.Fprintf(os.Stdout, "Response from `ViewingKeyAPI.ViewingKeyDecrypt`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiViewingKeyDecryptRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **viewingKeyDecryptRequest** | [**ViewingKeyDecryptRequest**](ViewingKeyDecryptRequest.md) |  | 

### Return type

[**ViewingKeyDecrypt200Response**](ViewingKeyDecrypt200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ViewingKeyDerive

> ViewingKeyDerive200Response ViewingKeyDerive(ctx).ViewingKeyDeriveRequest(viewingKeyDeriveRequest).Execute()

Derive child viewing key (BIP32-style)



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
	viewingKeyDeriveRequest := *openapiclient.NewViewingKeyDeriveRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), "ChildPath_example") // ViewingKeyDeriveRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ViewingKeyAPI.ViewingKeyDerive(context.Background()).ViewingKeyDeriveRequest(viewingKeyDeriveRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ViewingKeyAPI.ViewingKeyDerive``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ViewingKeyDerive`: ViewingKeyDerive200Response
	fmt.Fprintf(os.Stdout, "Response from `ViewingKeyAPI.ViewingKeyDerive`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiViewingKeyDeriveRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **viewingKeyDeriveRequest** | [**ViewingKeyDeriveRequest**](ViewingKeyDeriveRequest.md) |  | 

### Return type

[**ViewingKeyDerive200Response**](ViewingKeyDerive200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ViewingKeyDisclose

> ViewingKeyDisclose200Response ViewingKeyDisclose(ctx).ViewingKeyDiscloseRequest(viewingKeyDiscloseRequest).Execute()

Encrypt transaction for disclosure



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
	viewingKeyDiscloseRequest := *openapiclient.NewViewingKeyDiscloseRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), *openapiclient.NewViewingKeyDiscloseRequestTransactionData("Sender_example", "Recipient_example", "Amount_example", int32(123))) // ViewingKeyDiscloseRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ViewingKeyAPI.ViewingKeyDisclose(context.Background()).ViewingKeyDiscloseRequest(viewingKeyDiscloseRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ViewingKeyAPI.ViewingKeyDisclose``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ViewingKeyDisclose`: ViewingKeyDisclose200Response
	fmt.Fprintf(os.Stdout, "Response from `ViewingKeyAPI.ViewingKeyDisclose`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiViewingKeyDiscloseRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **viewingKeyDiscloseRequest** | [**ViewingKeyDiscloseRequest**](ViewingKeyDiscloseRequest.md) |  | 

### Return type

[**ViewingKeyDisclose200Response**](ViewingKeyDisclose200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ViewingKeyGenerate

> ViewingKeyGenerate200Response ViewingKeyGenerate(ctx).ViewingKeyGenerateRequest(viewingKeyGenerateRequest).Execute()

Generate viewing key

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
	viewingKeyGenerateRequest := *openapiclient.NewViewingKeyGenerateRequest() // ViewingKeyGenerateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ViewingKeyAPI.ViewingKeyGenerate(context.Background()).ViewingKeyGenerateRequest(viewingKeyGenerateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ViewingKeyAPI.ViewingKeyGenerate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ViewingKeyGenerate`: ViewingKeyGenerate200Response
	fmt.Fprintf(os.Stdout, "Response from `ViewingKeyAPI.ViewingKeyGenerate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiViewingKeyGenerateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **viewingKeyGenerateRequest** | [**ViewingKeyGenerateRequest**](ViewingKeyGenerateRequest.md) |  | 

### Return type

[**ViewingKeyGenerate200Response**](ViewingKeyGenerate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ViewingKeyVerifyHierarchy

> ViewingKeyVerifyHierarchy200Response ViewingKeyVerifyHierarchy(ctx).ViewingKeyVerifyHierarchyRequest(viewingKeyVerifyHierarchyRequest).Execute()

Verify viewing key parent-child relationship



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
	viewingKeyVerifyHierarchyRequest := *openapiclient.NewViewingKeyVerifyHierarchyRequest(*openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), *openapiclient.NewViewingKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Path_example", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"), "ChildPath_example") // ViewingKeyVerifyHierarchyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ViewingKeyAPI.ViewingKeyVerifyHierarchy(context.Background()).ViewingKeyVerifyHierarchyRequest(viewingKeyVerifyHierarchyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ViewingKeyAPI.ViewingKeyVerifyHierarchy``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ViewingKeyVerifyHierarchy`: ViewingKeyVerifyHierarchy200Response
	fmt.Fprintf(os.Stdout, "Response from `ViewingKeyAPI.ViewingKeyVerifyHierarchy`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiViewingKeyVerifyHierarchyRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **viewingKeyVerifyHierarchyRequest** | [**ViewingKeyVerifyHierarchyRequest**](ViewingKeyVerifyHierarchyRequest.md) |  | 

### Return type

[**ViewingKeyVerifyHierarchy200Response**](ViewingKeyVerifyHierarchy200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

