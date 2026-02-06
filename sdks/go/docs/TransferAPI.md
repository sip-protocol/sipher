# \TransferAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**TransferClaim**](TransferAPI.md#TransferClaim) | **Post** /v1/transfer/claim | Claim stealth payment (signed)
[**TransferPrivate**](TransferAPI.md#TransferPrivate) | **Post** /v1/transfer/private | Build unified private transfer (chain-agnostic)
[**TransferShield**](TransferAPI.md#TransferShield) | **Post** /v1/transfer/shield | Build shielded transfer (unsigned)



## TransferClaim

> TransferClaim200Response TransferClaim(ctx).TransferClaimRequest(transferClaimRequest).Execute()

Claim stealth payment (signed)



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
	transferClaimRequest := *openapiclient.NewTransferClaimRequest("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at") // TransferClaimRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TransferAPI.TransferClaim(context.Background()).TransferClaimRequest(transferClaimRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TransferAPI.TransferClaim``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TransferClaim`: TransferClaim200Response
	fmt.Fprintf(os.Stdout, "Response from `TransferAPI.TransferClaim`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTransferClaimRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **transferClaimRequest** | [**TransferClaimRequest**](TransferClaimRequest.md) |  | 

### Return type

[**TransferClaim200Response**](TransferClaim200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## TransferPrivate

> TransferPrivate200Response TransferPrivate(ctx).TransferPrivateRequest(transferPrivateRequest).Execute()

Build unified private transfer (chain-agnostic)



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
	transferPrivateRequest := *openapiclient.NewTransferPrivateRequest("Sender_example", *openapiclient.NewTransferPrivateRequestRecipientMetaAddress("SpendingKey_example", "ViewingKey_example", "Chain_example"), "1000000000") // TransferPrivateRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TransferAPI.TransferPrivate(context.Background()).TransferPrivateRequest(transferPrivateRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TransferAPI.TransferPrivate``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TransferPrivate`: TransferPrivate200Response
	fmt.Fprintf(os.Stdout, "Response from `TransferAPI.TransferPrivate`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTransferPrivateRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **transferPrivateRequest** | [**TransferPrivateRequest**](TransferPrivateRequest.md) |  | 

### Return type

[**TransferPrivate200Response**](TransferPrivate200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## TransferShield

> TransferShield200Response TransferShield(ctx).TransferShieldRequest(transferShieldRequest).Execute()

Build shielded transfer (unsigned)



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
	transferShieldRequest := *openapiclient.NewTransferShieldRequest("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at", *openapiclient.NewStealthMetaAddress("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "Chain_example"), "1000000000") // TransferShieldRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.TransferAPI.TransferShield(context.Background()).TransferShieldRequest(transferShieldRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `TransferAPI.TransferShield``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TransferShield`: TransferShield200Response
	fmt.Fprintf(os.Stdout, "Response from `TransferAPI.TransferShield`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTransferShieldRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **transferShieldRequest** | [**TransferShieldRequest**](TransferShieldRequest.md) |  | 

### Return type

[**TransferShield200Response**](TransferShield200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

