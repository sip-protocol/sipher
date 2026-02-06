# \CSPLAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CsplTransfer**](CSPLAPI.md#CsplTransfer) | **Post** /v1/cspl/transfer | Confidential token transfer
[**CsplUnwrap**](CSPLAPI.md#CsplUnwrap) | **Post** /v1/cspl/unwrap | Unwrap confidential tokens back to SPL
[**CsplWrap**](CSPLAPI.md#CsplWrap) | **Post** /v1/cspl/wrap | Wrap SPL tokens into confidential balance



## CsplTransfer

> CsplTransfer200Response CsplTransfer(ctx).CsplTransferRequest(csplTransferRequest).Execute()

Confidential token transfer



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
	csplTransferRequest := *openapiclient.NewCsplTransferRequest("CsplMint_example", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "EncryptedAmount_example") // CsplTransferRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CSPLAPI.CsplTransfer(context.Background()).CsplTransferRequest(csplTransferRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CSPLAPI.CsplTransfer``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CsplTransfer`: CsplTransfer200Response
	fmt.Fprintf(os.Stdout, "Response from `CSPLAPI.CsplTransfer`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCsplTransferRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **csplTransferRequest** | [**CsplTransferRequest**](CsplTransferRequest.md) |  | 

### Return type

[**CsplTransfer200Response**](CsplTransfer200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CsplUnwrap

> CsplUnwrap200Response CsplUnwrap(ctx).CsplUnwrapRequest(csplUnwrapRequest).Execute()

Unwrap confidential tokens back to SPL



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
	csplUnwrapRequest := *openapiclient.NewCsplUnwrapRequest("CsplMint_example", "EncryptedAmount_example", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at") // CsplUnwrapRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CSPLAPI.CsplUnwrap(context.Background()).CsplUnwrapRequest(csplUnwrapRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CSPLAPI.CsplUnwrap``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CsplUnwrap`: CsplUnwrap200Response
	fmt.Fprintf(os.Stdout, "Response from `CSPLAPI.CsplUnwrap`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCsplUnwrapRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **csplUnwrapRequest** | [**CsplUnwrapRequest**](CsplUnwrapRequest.md) |  | 

### Return type

[**CsplUnwrap200Response**](CsplUnwrap200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CsplWrap

> CsplWrap200Response CsplWrap(ctx).CsplWrapRequest(csplWrapRequest).Execute()

Wrap SPL tokens into confidential balance



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
	csplWrapRequest := *openapiclient.NewCsplWrapRequest("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "1000000000", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at") // CsplWrapRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CSPLAPI.CsplWrap(context.Background()).CsplWrapRequest(csplWrapRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CSPLAPI.CsplWrap``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CsplWrap`: CsplWrap200Response
	fmt.Fprintf(os.Stdout, "Response from `CSPLAPI.CsplWrap`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCsplWrapRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **csplWrapRequest** | [**CsplWrapRequest**](CsplWrapRequest.md) |  | 

### Return type

[**CsplWrap200Response**](CsplWrap200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

