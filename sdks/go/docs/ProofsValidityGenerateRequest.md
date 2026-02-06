# ProofsValidityGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**IntentHash** | **string** | 0x-prefixed 32-byte hex string | 
**SenderAddress** | **string** |  | 
**SenderBlinding** | **string** | 0x-prefixed 32-byte hex string | 
**SenderSecret** | **string** | 0x-prefixed 32-byte hex string | 
**AuthorizationSignature** | **string** |  | 
**Nonce** | **string** | 0x-prefixed 32-byte hex string | 
**Timestamp** | **int32** |  | 
**Expiry** | **int32** |  | 

## Methods

### NewProofsValidityGenerateRequest

`func NewProofsValidityGenerateRequest(intentHash string, senderAddress string, senderBlinding string, senderSecret string, authorizationSignature string, nonce string, timestamp int32, expiry int32, ) *ProofsValidityGenerateRequest`

NewProofsValidityGenerateRequest instantiates a new ProofsValidityGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProofsValidityGenerateRequestWithDefaults

`func NewProofsValidityGenerateRequestWithDefaults() *ProofsValidityGenerateRequest`

NewProofsValidityGenerateRequestWithDefaults instantiates a new ProofsValidityGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetIntentHash

`func (o *ProofsValidityGenerateRequest) GetIntentHash() string`

GetIntentHash returns the IntentHash field if non-nil, zero value otherwise.

### GetIntentHashOk

`func (o *ProofsValidityGenerateRequest) GetIntentHashOk() (*string, bool)`

GetIntentHashOk returns a tuple with the IntentHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIntentHash

`func (o *ProofsValidityGenerateRequest) SetIntentHash(v string)`

SetIntentHash sets IntentHash field to given value.


### GetSenderAddress

`func (o *ProofsValidityGenerateRequest) GetSenderAddress() string`

GetSenderAddress returns the SenderAddress field if non-nil, zero value otherwise.

### GetSenderAddressOk

`func (o *ProofsValidityGenerateRequest) GetSenderAddressOk() (*string, bool)`

GetSenderAddressOk returns a tuple with the SenderAddress field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSenderAddress

`func (o *ProofsValidityGenerateRequest) SetSenderAddress(v string)`

SetSenderAddress sets SenderAddress field to given value.


### GetSenderBlinding

`func (o *ProofsValidityGenerateRequest) GetSenderBlinding() string`

GetSenderBlinding returns the SenderBlinding field if non-nil, zero value otherwise.

### GetSenderBlindingOk

`func (o *ProofsValidityGenerateRequest) GetSenderBlindingOk() (*string, bool)`

GetSenderBlindingOk returns a tuple with the SenderBlinding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSenderBlinding

`func (o *ProofsValidityGenerateRequest) SetSenderBlinding(v string)`

SetSenderBlinding sets SenderBlinding field to given value.


### GetSenderSecret

`func (o *ProofsValidityGenerateRequest) GetSenderSecret() string`

GetSenderSecret returns the SenderSecret field if non-nil, zero value otherwise.

### GetSenderSecretOk

`func (o *ProofsValidityGenerateRequest) GetSenderSecretOk() (*string, bool)`

GetSenderSecretOk returns a tuple with the SenderSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSenderSecret

`func (o *ProofsValidityGenerateRequest) SetSenderSecret(v string)`

SetSenderSecret sets SenderSecret field to given value.


### GetAuthorizationSignature

`func (o *ProofsValidityGenerateRequest) GetAuthorizationSignature() string`

GetAuthorizationSignature returns the AuthorizationSignature field if non-nil, zero value otherwise.

### GetAuthorizationSignatureOk

`func (o *ProofsValidityGenerateRequest) GetAuthorizationSignatureOk() (*string, bool)`

GetAuthorizationSignatureOk returns a tuple with the AuthorizationSignature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuthorizationSignature

`func (o *ProofsValidityGenerateRequest) SetAuthorizationSignature(v string)`

SetAuthorizationSignature sets AuthorizationSignature field to given value.


### GetNonce

`func (o *ProofsValidityGenerateRequest) GetNonce() string`

GetNonce returns the Nonce field if non-nil, zero value otherwise.

### GetNonceOk

`func (o *ProofsValidityGenerateRequest) GetNonceOk() (*string, bool)`

GetNonceOk returns a tuple with the Nonce field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNonce

`func (o *ProofsValidityGenerateRequest) SetNonce(v string)`

SetNonce sets Nonce field to given value.


### GetTimestamp

`func (o *ProofsValidityGenerateRequest) GetTimestamp() int32`

GetTimestamp returns the Timestamp field if non-nil, zero value otherwise.

### GetTimestampOk

`func (o *ProofsValidityGenerateRequest) GetTimestampOk() (*int32, bool)`

GetTimestampOk returns a tuple with the Timestamp field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTimestamp

`func (o *ProofsValidityGenerateRequest) SetTimestamp(v int32)`

SetTimestamp sets Timestamp field to given value.


### GetExpiry

`func (o *ProofsValidityGenerateRequest) GetExpiry() int32`

GetExpiry returns the Expiry field if non-nil, zero value otherwise.

### GetExpiryOk

`func (o *ProofsValidityGenerateRequest) GetExpiryOk() (*int32, bool)`

GetExpiryOk returns a tuple with the Expiry field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiry

`func (o *ProofsValidityGenerateRequest) SetExpiry(v int32)`

SetExpiry sets Expiry field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


