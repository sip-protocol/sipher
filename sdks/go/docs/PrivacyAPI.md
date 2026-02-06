# \PrivacyAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**PrivacyScore**](PrivacyAPI.md#PrivacyScore) | **Post** /v1/privacy/score | Analyze wallet privacy score



## PrivacyScore

> PrivacyScore200Response PrivacyScore(ctx).PrivacyScoreRequest(privacyScoreRequest).Execute()

Analyze wallet privacy score



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
	privacyScoreRequest := *openapiclient.NewPrivacyScoreRequest("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at") // PrivacyScoreRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PrivacyAPI.PrivacyScore(context.Background()).PrivacyScoreRequest(privacyScoreRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PrivacyAPI.PrivacyScore``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PrivacyScore`: PrivacyScore200Response
	fmt.Fprintf(os.Stdout, "Response from `PrivacyAPI.PrivacyScore`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiPrivacyScoreRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **privacyScoreRequest** | [**PrivacyScoreRequest**](PrivacyScoreRequest.md) |  | 

### Return type

[**PrivacyScore200Response**](PrivacyScore200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

