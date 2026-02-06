# ViewingKeyDeriveRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**MasterKey** | [**ViewingKey**](ViewingKey.md) |  | 
**ChildPath** | **string** | Derivation path segment (e.g., \&quot;audit\&quot;, \&quot;2026/Q1\&quot;) | 

## Methods

### NewViewingKeyDeriveRequest

`func NewViewingKeyDeriveRequest(masterKey ViewingKey, childPath string, ) *ViewingKeyDeriveRequest`

NewViewingKeyDeriveRequest instantiates a new ViewingKeyDeriveRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyDeriveRequestWithDefaults

`func NewViewingKeyDeriveRequestWithDefaults() *ViewingKeyDeriveRequest`

NewViewingKeyDeriveRequestWithDefaults instantiates a new ViewingKeyDeriveRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMasterKey

`func (o *ViewingKeyDeriveRequest) GetMasterKey() ViewingKey`

GetMasterKey returns the MasterKey field if non-nil, zero value otherwise.

### GetMasterKeyOk

`func (o *ViewingKeyDeriveRequest) GetMasterKeyOk() (*ViewingKey, bool)`

GetMasterKeyOk returns a tuple with the MasterKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMasterKey

`func (o *ViewingKeyDeriveRequest) SetMasterKey(v ViewingKey)`

SetMasterKey sets MasterKey field to given value.


### GetChildPath

`func (o *ViewingKeyDeriveRequest) GetChildPath() string`

GetChildPath returns the ChildPath field if non-nil, zero value otherwise.

### GetChildPathOk

`func (o *ViewingKeyDeriveRequest) GetChildPathOk() (*string, bool)`

GetChildPathOk returns a tuple with the ChildPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChildPath

`func (o *ViewingKeyDeriveRequest) SetChildPath(v string)`

SetChildPath sets ChildPath field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


