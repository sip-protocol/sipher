# ViewingKeyGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Path** | Pointer to **string** | Derivation path | [optional] [default to "m/0"]
**Label** | Pointer to **string** |  | [optional] 

## Methods

### NewViewingKeyGenerateRequest

`func NewViewingKeyGenerateRequest() *ViewingKeyGenerateRequest`

NewViewingKeyGenerateRequest instantiates a new ViewingKeyGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyGenerateRequestWithDefaults

`func NewViewingKeyGenerateRequestWithDefaults() *ViewingKeyGenerateRequest`

NewViewingKeyGenerateRequestWithDefaults instantiates a new ViewingKeyGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPath

`func (o *ViewingKeyGenerateRequest) GetPath() string`

GetPath returns the Path field if non-nil, zero value otherwise.

### GetPathOk

`func (o *ViewingKeyGenerateRequest) GetPathOk() (*string, bool)`

GetPathOk returns a tuple with the Path field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPath

`func (o *ViewingKeyGenerateRequest) SetPath(v string)`

SetPath sets Path field to given value.

### HasPath

`func (o *ViewingKeyGenerateRequest) HasPath() bool`

HasPath returns a boolean if a field has been set.

### GetLabel

`func (o *ViewingKeyGenerateRequest) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *ViewingKeyGenerateRequest) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *ViewingKeyGenerateRequest) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *ViewingKeyGenerateRequest) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


