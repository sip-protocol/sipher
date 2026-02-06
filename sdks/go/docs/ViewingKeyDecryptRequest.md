# ViewingKeyDecryptRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingKey** | [**ViewingKey**](ViewingKey.md) |  | 
**Encrypted** | [**ViewingKeyDecryptRequestEncrypted**](ViewingKeyDecryptRequestEncrypted.md) |  | 

## Methods

### NewViewingKeyDecryptRequest

`func NewViewingKeyDecryptRequest(viewingKey ViewingKey, encrypted ViewingKeyDecryptRequestEncrypted, ) *ViewingKeyDecryptRequest`

NewViewingKeyDecryptRequest instantiates a new ViewingKeyDecryptRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyDecryptRequestWithDefaults

`func NewViewingKeyDecryptRequestWithDefaults() *ViewingKeyDecryptRequest`

NewViewingKeyDecryptRequestWithDefaults instantiates a new ViewingKeyDecryptRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingKey

`func (o *ViewingKeyDecryptRequest) GetViewingKey() ViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *ViewingKeyDecryptRequest) GetViewingKeyOk() (*ViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *ViewingKeyDecryptRequest) SetViewingKey(v ViewingKey)`

SetViewingKey sets ViewingKey field to given value.


### GetEncrypted

`func (o *ViewingKeyDecryptRequest) GetEncrypted() ViewingKeyDecryptRequestEncrypted`

GetEncrypted returns the Encrypted field if non-nil, zero value otherwise.

### GetEncryptedOk

`func (o *ViewingKeyDecryptRequest) GetEncryptedOk() (*ViewingKeyDecryptRequestEncrypted, bool)`

GetEncryptedOk returns a tuple with the Encrypted field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEncrypted

`func (o *ViewingKeyDecryptRequest) SetEncrypted(v ViewingKeyDecryptRequestEncrypted)`

SetEncrypted sets Encrypted field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


